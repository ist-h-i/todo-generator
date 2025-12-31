from copy import deepcopy
import re
from typing import Any, Iterable, Mapping, Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from .. import models
from ..auth import get_current_user
from ..database import get_db
from ..schemas import (
    AnalysisCard,
    AnalysisRequest,
    AnalysisResponse,
    ImmunityMapAItem,
    ImmunityMapCandidate,
    ImmunityMapCandidateRequest,
    ImmunityMapCandidateResponse,
    ImmunityMapEvidence,
    ImmunityMapEdge,
    ImmunityMapNode,
    ImmunityMapPayload,
    ImmunityMapReadoutCard,
    ImmunityMapRequest,
    ImmunityMapResponse,
)
from ..services.gemini import (
    GeminiClient,
    GeminiError,
    GeminiRateLimitError,
    build_workspace_analysis_options,
    get_gemini_client,
)
from ..services.immunity_map import (
    DEFAULT_IMMUNITY_MAP_WINDOW_DAYS,
    build_immunity_map_context,
)
from ..services.profile import build_user_profile

router = APIRouter(prefix="/analysis", tags=["analysis"])


_LABEL_ID_PATTERN = re.compile(r"\b(?:id|label_id|label)\s*[:=]\s*([A-Za-z0-9_-]+)", re.IGNORECASE)


def _normalize_label_name(value: str) -> str | None:
    """Return a trimmed label candidate without trailing metadata."""

    text = " ".join(value.strip().split())
    if not text:
        return None

    prefix_match = re.match(r"^(?:label|labels)\s*[:=]\s*(.+)$", text, flags=re.IGNORECASE)
    if prefix_match:
        text = prefix_match.group(1).strip()

    text = re.sub(r"\s*\([^()]*?(?:id|label)[^()]*\)\s*$", "", text).strip()
    text = text.strip("'\"")
    if not text:
        return None

    return text[:100]


def _tokenize_label(value: str) -> set[str]:
    tokens: set[str] = set()
    normalized = value.strip()
    if normalized:
        tokens.add(normalized)

    for match in _LABEL_ID_PATTERN.finditer(value):
        candidate = match.group(1).strip()
        if candidate:
            tokens.add(candidate)

    for part in re.split(r"[\s,;、/|()[\]{}]+", value):
        candidate = part.strip()
        if candidate:
            tokens.add(candidate)

    return tokens


def _ensure_labels_registered(
    db: Session,
    *,
    owner_id: str,
    proposals: Iterable[AnalysisCard],
    workspace_labels: Iterable[tuple[str, str]],
) -> None:
    known_ids: dict[str, str] = {}
    known_names: dict[str, str] = {}

    for label_id, label_name in workspace_labels:
        known_ids[label_id.casefold()] = label_id
        if label_name:
            known_names[label_name.casefold()] = label_id

    for proposal in proposals:
        resolved_label_ids: list[str] = []
        for raw_label in list(proposal.labels):
            tokens = _tokenize_label(raw_label)
            match_id: str | None = None
            for token in tokens:
                existing = known_ids.get(token.casefold())
                if existing:
                    match_id = existing
                    break

            if match_id is None:
                candidate_name = None
                for token in tokens:
                    candidate = known_names.get(token.casefold())
                    if candidate:
                        match_id = candidate
                        break
                if match_id is None:
                    candidate_name = _normalize_label_name(raw_label)
                    if candidate_name:
                        lookup_key = candidate_name.casefold()
                        match_id = known_names.get(lookup_key)
                        if match_id is None:
                            label = models.Label(
                                name=candidate_name,
                                owner_id=owner_id,
                            )
                            db.add(label)
                            db.flush()
                            match_id = label.id
                            known_ids[match_id.casefold()] = match_id
                            known_names[lookup_key] = match_id

            if match_id:
                resolved_label_ids.append(match_id)

        proposal.labels = resolved_label_ids


@router.post("", response_model=AnalysisResponse)
def analyze(
    payload: AnalysisRequest,
    gemini: GeminiClient = Depends(get_gemini_client),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisResponse:
    """Analyze free-form text and return structured card proposals."""

    profile = build_user_profile(current_user)
    workspace_options = build_workspace_analysis_options(db, owner_id=current_user.id)
    raw_notes = payload.notes if payload.notes is not None else payload.text
    notes = raw_notes.strip() if raw_notes else None
    objective = payload.objective.strip() if payload.objective else None
    record = models.AnalysisSession(
        user_id=current_user.id,
        request_text=payload.text,
        notes=notes,
        objective=objective,
        auto_objective=bool(payload.auto_objective),
        max_cards=payload.max_cards,
    )
    db.add(record)
    db.flush()
    try:
        response = gemini.analyze(
            payload,
            user_profile=profile,
            workspace_options=workspace_options,
        )
    except GeminiRateLimitError as exc:
        record.status = "failed"
        record.failure_reason = str(exc)
        db.commit()
        headers: dict[str, str] | None = None
        if exc.retry_after_seconds is not None:
            headers = {"Retry-After": str(exc.retry_after_seconds)}
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
            headers=headers,
        ) from exc
    except GeminiError as exc:
        record.status = "failed"
        record.failure_reason = str(exc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    _ensure_labels_registered(
        db,
        owner_id=current_user.id,
        proposals=response.proposals,
        workspace_labels=((label.id, label.name) for label in workspace_options.labels),
    )

    record.status = "completed"
    record.response_model = response.model
    record.proposals = [proposal.model_dump() for proposal in response.proposals]
    db.commit()
    return response


_IMMUNITY_MAP_SYSTEM_PROMPT = (
    "You are Verbalize Yourself's reflection assistant."
    " You infer an Immunity Map from user-provided statements."
    " Your output must be a JSON object that matches the provided schema."
    " Write labels in natural Japanese."
    " Provide optional readout_cards that distinguish observation vs hypothesis and include evidence when possible."
    " Treat deep psychology as hypotheses; avoid clinical or diagnostic language."
    " Do not include any extra keys or any prose outside JSON."
)

_IMMUNITY_MAP_CANDIDATE_SYSTEM_PROMPT = (
    "You are Verbalize Yourself's reflection assistant."
    " Generate candidate A items for an Immunity Map using the provided context."
    " Keep A item text concise and written in natural Japanese."
    " Treat deep psychology as hypotheses; avoid clinical or diagnostic language."
    " Provide evidence references only from the supplied context."
    " Respond strictly with JSON that matches the provided schema."
    " Do not include any extra keys or any prose outside JSON."
)

_IMMUNITY_MAP_CANDIDATE_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "candidates": {
            "type": "array",
            "default": [],
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["a_item", "rationale"],
                "properties": {
                    "a_item": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["kind", "text"],
                        "properties": {
                            "kind": {"type": "string", "enum": ["should", "cannot", "want"]},
                            "text": {"type": "string", "minLength": 1},
                        },
                    },
                    "rationale": {"type": "string", "minLength": 1},
                    "confidence": {"type": "number"},
                    "questions": {
                        "type": "array",
                        "default": [],
                        "items": {"type": "string"},
                    },
                    "evidence": {
                        "type": "array",
                        "default": [],
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["type"],
                            "properties": {
                                "type": {
                                    "type": "string",
                                    "enum": ["status_report", "card", "snapshot", "other"],
                                },
                                "id": {"type": "string"},
                                "snippet": {"type": "string"},
                                "timestamp": {"type": "string"},
                            },
                        },
                    },
                },
            },
        },
    },
    "required": ["candidates"],
}


_IMMUNITY_MAP_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "nodes": {
            "type": "array",
            "default": [],
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "group", "label"],
                "properties": {
                    "id": {"type": "string", "minLength": 2},
                    "group": {"type": "string", "enum": ["A", "B", "C", "D", "E", "F"]},
                    "label": {"type": "string", "minLength": 1},
                    "kind": {"type": "string", "enum": ["should", "cannot", "want"]},
                },
            },
        },
        "edges": {
            "type": "array",
            "default": [],
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["from", "to"],
                "properties": {
                    "from": {"type": "string", "minLength": 2},
                    "to": {"type": "string", "minLength": 2},
                },
            },
        },
        "summary": {"type": "string"},
        "readout_cards": {
            "type": "array",
            "default": [],
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["title", "kind", "body"],
                "properties": {
                    "title": {"type": "string"},
                    "kind": {
                        "type": "string",
                        "enum": [
                            "observation",
                            "hypothesis",
                            "barrier",
                            "need",
                            "assumption",
                            "next_step",
                        ],
                    },
                    "body": {"type": "string"},
                    "evidence": {
                        "type": "array",
                        "default": [],
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["type"],
                            "properties": {
                                "type": {
                                    "type": "string",
                                    "enum": ["status_report", "card", "snapshot", "other"],
                                },
                                "id": {"type": "string"},
                                "snippet": {"type": "string"},
                                "timestamp": {"type": "string"},
                            },
                        },
                    },
                },
            },
        },
    },
    "required": ["nodes", "edges"],
}


def _escape_mermaid_label(value: str) -> str:
    return (
        value.replace("\r", "")
        .replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "<br/>")
        .strip()
    )


def _sort_node_id(value: str) -> tuple[int, str]:
    match = re.match(r"^([A-F])(\d+)$", value)
    if not match:
        return (10**9, value)
    return (int(match.group(2)), value)


def _render_immunity_map_mermaid(
    *,
    nodes: Sequence[ImmunityMapNode],
    edges: Sequence[ImmunityMapEdge],
) -> str:
    groups: dict[str, list[ImmunityMapNode]] = {}
    for node in nodes:
        groups.setdefault(node.group, []).append(node)

    group_titles: dict[str, str] = {
        "A": "階層1：A（やるべき/やれない/やりたい）",
        "B": "階層2：B（阻害要因）",
        "C": "階層2：C（裏の目標/理想像/ゴール）",
        "D": "階層3：D（深層心理/バイアス：B の原因）",
        "E": "階層3：E（真のニーズ）",
        "F": "階層3：F（根源的固定概念）",
    }

    lines: list[str] = ["flowchart TD"]
    for group_key in ["A", "B", "C", "D", "E", "F"]:
        bucket = groups.get(group_key)
        if not bucket:
            continue
        title = group_titles.get(group_key, group_key)
        lines.append(f'  subgraph {group_key}["{_escape_mermaid_label(title)}"]')
        for node in sorted(bucket, key=lambda item: _sort_node_id(item.id)):
            lines.append(f'    {node.id}["{_escape_mermaid_label(node.label)}"]')
        lines.append("  end")

    if edges:
        lines.append("")
        for edge in edges:
            lines.append(f"  {edge.from_} --> {edge.to}")

    return "\n".join(lines).strip() + "\n"


def _to_mapping(value: Any) -> Mapping[str, Any] | None:
    return value if isinstance(value, Mapping) else None


def _safe_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value is None:
        return []
    return [value]


_MAX_LABEL_LENGTH = 200
_ALLOWED_READOUT_KINDS = {
    "observation",
    "hypothesis",
    "barrier",
    "need",
    "assumption",
    "next_step",
}
_ALLOWED_EVIDENCE_TYPES = {"status_report", "card", "snapshot", "other"}


def _resolve_context_policy(payload: ImmunityMapRequest) -> str:
    policy = payload.context_policy or ("auto+manual" if payload.context else "auto")
    if policy == "auto" and payload.context:
        return "auto+manual"
    if policy not in {"auto", "manual", "auto+manual"}:
        return "auto"
    return policy


def _truncate_label(value: str) -> str:
    normalized = " ".join(value.split()).strip()
    if len(normalized) <= _MAX_LABEL_LENGTH:
        return normalized
    return normalized[: _MAX_LABEL_LENGTH].rstrip()


def _coerce_confidence(value: Any) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if 0 < numeric <= 1:
        numeric *= 100
    return max(0.0, min(100.0, numeric))


def _parse_questions(value: Any) -> list[str]:
    items = _safe_list(value)
    questions: list[str] = []
    for item in items:
        text = str(item or "").strip()
        if text:
            questions.append(text)
    return questions


def _parse_evidence_list(value: Any) -> list[ImmunityMapEvidence]:
    evidence: list[ImmunityMapEvidence] = []
    for raw in _safe_list(value):
        item = _to_mapping(raw)
        if not item:
            continue
        evidence_type = str(item.get("type") or "").strip()
        if evidence_type not in _ALLOWED_EVIDENCE_TYPES:
            continue
        payload = {
            "type": evidence_type,
            "id": item.get("id"),
            "snippet": item.get("snippet"),
            "timestamp": item.get("timestamp"),
        }
        try:
            evidence.append(ImmunityMapEvidence(**payload))
        except ValidationError:
            continue
    return evidence


def _parse_immunity_map_candidates(raw_value: Any, max_candidates: int) -> list[ImmunityMapCandidate]:
    candidates: list[ImmunityMapCandidate] = []
    for index, raw in enumerate(_safe_list(raw_value), start=1):
        if len(candidates) >= max_candidates:
            break
        item = _to_mapping(raw)
        if not item:
            continue
        a_item_raw = _to_mapping(item.get("a_item"))
        if not a_item_raw:
            continue
        kind = str(a_item_raw.get("kind") or "").strip()
        text = _truncate_label(str(a_item_raw.get("text") or ""))
        rationale = str(item.get("rationale") or "").strip()
        if not kind or not text or not rationale:
            continue
        try:
            a_item = ImmunityMapAItem(kind=kind, text=text)
        except ValidationError:
            continue
        confidence = _coerce_confidence(item.get("confidence"))
        questions = _parse_questions(item.get("questions"))
        evidence = _parse_evidence_list(item.get("evidence"))
        candidate_id = f"cand_{len(candidates) + 1}"
        try:
            candidates.append(
                ImmunityMapCandidate(
                    id=candidate_id,
                    a_item=a_item,
                    rationale=rationale,
                    confidence=confidence,
                    questions=questions,
                    evidence=evidence,
                )
            )
        except ValidationError:
            continue
    return candidates


def _parse_readout_cards(raw_value: Any) -> list[ImmunityMapReadoutCard]:
    cards: list[ImmunityMapReadoutCard] = []
    for raw in _safe_list(raw_value):
        item = _to_mapping(raw)
        if not item:
            continue
        title = str(item.get("title") or "").strip()
        body = str(item.get("body") or "").strip()
        kind = str(item.get("kind") or "").strip()
        if not title or not body or kind not in _ALLOWED_READOUT_KINDS:
            continue
        evidence = _parse_evidence_list(item.get("evidence"))
        try:
            cards.append(
                ImmunityMapReadoutCard(
                    title=title,
                    kind=kind,
                    body=body,
                    evidence=evidence,
                )
            )
        except ValidationError:
            continue
    return cards


@router.post("/immunity-map/candidates", response_model=ImmunityMapCandidateResponse)
def generate_immunity_map_candidates(
    payload: ImmunityMapCandidateRequest,
    gemini: GeminiClient = Depends(get_gemini_client),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ImmunityMapCandidateResponse:
    include = payload.include
    context_bundle = build_immunity_map_context(
        db,
        user=current_user,
        window_days=payload.window_days,
        include_status_reports=include.status_reports,
        include_cards=include.cards,
        include_profile=include.profile,
        include_snapshots=include.snapshots,
    )
    response_schema = deepcopy(_IMMUNITY_MAP_CANDIDATE_RESPONSE_SCHEMA)
    candidates_schema = response_schema.get("properties", {}).get("candidates")
    if isinstance(candidates_schema, dict):
        candidates_schema["maxItems"] = payload.max_candidates

    prompt_parts = [
        "Generate candidate A items for an Immunity Map.",
        f"Return between 1 and {payload.max_candidates} candidates.",
        "",
        "Context JSON:",
        context_bundle.prompt,
        "",
        "Output rules:",
        "- Provide a_item {kind, text} with short, user-friendly Japanese text.",
        "- Provide rationale as a hypothesis, not a diagnosis.",
        "- Use evidence only from the context; avoid fabrication.",
        "- If evidence is weak, keep confidence low and add questions.",
    ]
    prompt = "\n".join(prompt_parts).strip()

    try:
        generated = gemini.generate_structured(
            prompt=prompt,
            response_schema=response_schema,
            system_prompt=_IMMUNITY_MAP_CANDIDATE_SYSTEM_PROMPT,
        )
    except GeminiRateLimitError as exc:
        headers: dict[str, str] | None = None
        if exc.retry_after_seconds is not None:
            headers = {"Retry-After": str(exc.retry_after_seconds)}
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
            headers=headers,
        ) from exc
    except GeminiError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    candidates = _parse_immunity_map_candidates(
        generated.get("candidates"),
        payload.max_candidates,
    )
    model = generated.get("model")
    token_usage = generated.get("token_usage")

    return ImmunityMapCandidateResponse(
        candidates=candidates,
        context_summary=context_bundle.summary,
        used_sources=context_bundle.used_sources,
        model=str(model) if model else None,
        token_usage=token_usage if isinstance(token_usage, Mapping) else {},
    )


@router.post("/immunity-map", response_model=ImmunityMapResponse)
def generate_immunity_map(
    payload: ImmunityMapRequest,
    gemini: GeminiClient = Depends(get_gemini_client),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ImmunityMapResponse:
    policy = _resolve_context_policy(payload)
    include_auto = policy in {"auto", "auto+manual"}
    include_manual = policy in {"manual", "auto+manual"}

    context = payload.context.strip() if include_manual and payload.context else ""
    context_bundle = None
    if include_auto:
        include_snapshots = bool(payload.target and payload.target.type == "snapshot")
        context_bundle = build_immunity_map_context(
            db,
            user=current_user,
            window_days=DEFAULT_IMMUNITY_MAP_WINDOW_DAYS,
            include_status_reports=True,
            include_cards=True,
            include_profile=True,
            include_snapshots=include_snapshots,
            target=payload.target,
        )

    a_nodes: list[ImmunityMapNode] = []
    kind_prefix = {"should": "", "cannot": "", "want": ""}
    for index, item in enumerate(payload.a_items, start=1):
        prefix = kind_prefix.get(item.kind, "")
        label = _truncate_label(f"{prefix}{item.text}")
        a_nodes.append(
            ImmunityMapNode(
                id=f"A{index}",
                group="A",
                label=label,
                kind=item.kind,
            )
        )

    a_lines = [f"- {node.id}: {node.label}" for node in a_nodes]
    user_prompt_parts = [
        "Create an Immunity Map for levels A through F. A nodes are provided.",
        "",
        "A (level 1):",
        *a_lines,
    ]
    if context_bundle and context_bundle.prompt and context_bundle.prompt != "{}":
        user_prompt_parts.extend(["", "Context (JSON):", context_bundle.prompt])
    if context:
        user_prompt_parts.extend(["", "Additional context:", context])

    user_prompt_parts.extend(
        [
            "",
            "Output rules:",
            "- Do not create new A nodes; only reference the provided A nodes.",
            "- Omit empty nodes, edges, and empty groups.",
            "- Allowed connections: A->B, A->C, B->D, B->E, C->E, C->F.",
            "- Keep labels short in natural Japanese and avoid clinical language.",
            "- readout_cards should distinguish observations vs hypotheses and include evidence.",
        ]
    )
    prompt = "\n".join(user_prompt_parts).strip()

    try:
        generated = gemini.generate_structured(
            prompt=prompt,
            response_schema=_IMMUNITY_MAP_RESPONSE_SCHEMA,
            system_prompt=_IMMUNITY_MAP_SYSTEM_PROMPT,
        )
    except GeminiRateLimitError as exc:
        headers: dict[str, str] | None = None
        if exc.retry_after_seconds is not None:
            headers = {"Retry-After": str(exc.retry_after_seconds)}
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
            headers=headers,
        ) from exc
    except GeminiError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    raw_nodes = _safe_list(generated.get("nodes"))
    raw_edges = _safe_list(generated.get("edges"))

    nodes: list[ImmunityMapNode] = list(a_nodes)
    node_ids: set[str] = {node.id for node in nodes}
    node_group: dict[str, str] = {node.id: node.group for node in nodes}

    for raw in raw_nodes:
        item = _to_mapping(raw)
        if not item:
            continue
        node_id = str(item.get("id") or "").strip()
        group = str(item.get("group") or "").strip()
        label = _truncate_label(str(item.get("label") or ""))

        if not node_id or not group or not label:
            continue
        if group == "A":
            continue
        if group not in {"B", "C", "D", "E", "F"}:
            continue
        if not node_id.startswith(group):
            continue
        if node_id in node_ids:
            continue

        nodes.append(ImmunityMapNode(id=node_id, group=group, label=label))
        node_ids.add(node_id)
        node_group[node_id] = group

    allowed_pairs = {
        ("A", "B"),
        ("A", "C"),
        ("B", "D"),
        ("B", "E"),
        ("C", "E"),
        ("C", "F"),
    }

    edges: list[ImmunityMapEdge] = []
    seen_edges: set[tuple[str, str]] = set()
    for raw in raw_edges:
        item = _to_mapping(raw)
        if not item:
            continue
        from_id = str(item.get("from") or item.get("from_") or "").strip()
        to_id = str(item.get("to") or "").strip()
        if not from_id or not to_id:
            continue
        if from_id == to_id:
            continue
        if from_id not in node_ids or to_id not in node_ids:
            continue
        pair = (node_group[from_id], node_group[to_id])
        if pair not in allowed_pairs:
            continue
        key = (from_id, to_id)
        if key in seen_edges:
            continue
        seen_edges.add(key)
        edges.append(ImmunityMapEdge(from_=from_id, to=to_id))

    mermaid = _render_immunity_map_mermaid(nodes=nodes, edges=edges)
    response_payload = ImmunityMapPayload(nodes=list(nodes), edges=list(edges))
    model = generated.get("model")
    token_usage = generated.get("token_usage")
    summary = generated.get("summary") if isinstance(generated.get("summary"), str) else None
    readout_cards = _parse_readout_cards(generated.get("readout_cards"))

    return ImmunityMapResponse(
        model=str(model) if model else None,
        payload=response_payload,
        mermaid=mermaid,
        summary=summary,
        readout_cards=readout_cards,
        token_usage=token_usage if isinstance(token_usage, Mapping) else {},
    )
