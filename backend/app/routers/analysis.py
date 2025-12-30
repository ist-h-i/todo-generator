import re
from typing import Any, Iterable, Mapping, Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models
from ..auth import get_current_user
from ..database import get_db
from ..schemas import (
    AnalysisCard,
    AnalysisRequest,
    AnalysisResponse,
    ImmunityMapEdge,
    ImmunityMapNode,
    ImmunityMapPayload,
    ImmunityMapRequest,
    ImmunityMapResponse,
)
from ..services.gemini import (
    GeminiClient,
    GeminiError,
    build_workspace_analysis_options,
    get_gemini_client,
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
    " Treat deep psychology as hypotheses; avoid clinical or diagnostic language."
    " Do not include any extra keys or any prose outside JSON."
)


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


@router.post("/immunity-map", response_model=ImmunityMapResponse)
def generate_immunity_map(
    payload: ImmunityMapRequest,
    gemini: GeminiClient = Depends(get_gemini_client),
    current_user: models.User = Depends(get_current_user),
) -> ImmunityMapResponse:
    a_nodes: list[ImmunityMapNode] = []
    kind_prefix = {"should": "やるべき：", "cannot": "やれない：", "want": "やりたい："}
    for index, item in enumerate(payload.a_items, start=1):
        prefix = kind_prefix.get(item.kind, "")
        a_nodes.append(
            ImmunityMapNode(
                id=f"A{index}",
                group="A",
                label=f"{prefix}{item.text}",
                kind=item.kind,
            )
        )

    context = payload.context.strip() if payload.context else ""
    a_lines = [f"- {node.id}: {node.label}" for node in a_nodes]
    user_prompt_parts = [
        "免疫マップ（A〜F）を作成してください。A は入力として与えます。",
        "",
        "A（階層1）:",
        *a_lines,
    ]
    if context:
        user_prompt_parts.extend(["", "背景（任意）:", context])

    user_prompt_parts.extend(
        [
            "",
            "出力ルール:",
            "- A のノードは生成しない（上記 A を参照する）。",
            "- 空のノードや空の線は出力しない。",
            "- 接続は次のみ: A→B, A→C, B→D, B→E, C→E, C→F。",
            "- ラベルは日本語で簡潔に（断定しすぎない）。",
        ]
    )
    prompt = "\n".join(user_prompt_parts).strip()

    try:
        generated = gemini.generate_structured(
            prompt=prompt,
            response_schema=_IMMUNITY_MAP_RESPONSE_SCHEMA,
            system_prompt=_IMMUNITY_MAP_SYSTEM_PROMPT,
        )
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
        label = str(item.get("label") or "").strip()

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

    return ImmunityMapResponse(
        model=str(model) if model else None,
        payload=response_payload,
        mermaid=mermaid,
        summary=summary,
        token_usage=token_usage if isinstance(token_usage, Mapping) else {},
    )
