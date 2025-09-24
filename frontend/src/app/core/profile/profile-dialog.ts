import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { createSignalForm } from '@lib/forms/signal-forms';

import { ProfileFormState, ProfileUpdatePayload, UserProfile } from './profile.models';
import { ProfileService } from './profile.service';

interface RoleTreeOptionInput {
  readonly label: string;
  readonly value?: string;
}

interface RoleTreeOption {
  readonly label: string;
  readonly value: string;
}

interface RoleTreeCategoryInput {
  readonly label: string;
  readonly valuePrefix?: string;
  readonly options?: readonly RoleTreeOptionInput[];
  readonly children?: readonly RoleTreeCategoryInput[];
}

interface RoleTreeCategory {
  readonly id: string;
  readonly label: string;
  readonly path: readonly string[];
  readonly options: readonly RoleTreeOption[];
  readonly children: readonly RoleTreeCategory[];
  readonly allOptionValues: readonly string[];
}

interface RoleOptionDescriptor extends RoleTreeOption {
  readonly groups: readonly string[];
  readonly categoryIds: readonly string[];
}

interface SelectedRoleDetail {
  readonly value: string;
  readonly label: string;
  readonly groups: readonly string[];
  readonly isCustom: boolean;
}

const ROLE_TREE_DEFINITION = [
  {
    label: 'プロダクトマネジメント',
    valuePrefix: 'プロダクトマネジメント',
    options: [
      { label: 'プロダクトマネージャー' },
      { label: 'プロダクトオーナー' },
      { label: 'スクラムマスター' },
      { label: 'PMO' },
      { label: 'ビジネスアナリスト' },
      { label: 'グロースマネージャー' },
    ],
  },
  {
    label: 'ソフトウェアエンジニアリング',
    children: [
      {
        label: 'フロントエンド',
        valuePrefix: 'フロントエンド',
        options: [
          { label: 'Webアプリケーション開発' },
          { label: 'モバイル・デスクトップアプリ' },
          { label: 'UI実装・デザインシステム' },
          { label: 'フロントエンドパフォーマンス最適化' },
          { label: 'アクセシビリティ改善' },
        ],
      },
      {
        label: 'バックエンド',
        valuePrefix: 'バックエンド',
        options: [
          { label: 'API・マイクロサービス開発' },
          { label: 'バッチ・データ連携開発' },
          { label: '認証基盤・セキュリティ' },
          { label: 'バックエンドアーキテクチャ設計' },
          { label: 'バックエンド性能最適化' },
        ],
      },
      {
        label: 'モバイル / クライアント',
        valuePrefix: 'モバイル',
        options: [
          { label: 'iOSアプリ開発' },
          { label: 'Androidアプリ開発' },
          { label: 'クロスプラットフォーム開発' },
          { label: 'モバイルUX改善' },
        ],
      },
      {
        label: 'インフラ / SRE',
        valuePrefix: 'インフラ',
        options: [
          { label: 'クラウドインフラ構築' },
          { label: 'CI/CD・DevOps' },
          { label: '監視・運用自動化' },
          { label: 'ネットワーク設計・運用' },
          { label: 'インフラコスト最適化' },
        ],
      },
      {
        label: '品質保証',
        valuePrefix: '品質保証',
        options: [
          { label: 'QA計画・テスト設計' },
          { label: 'テスト自動化' },
          { label: '受け入れテスト支援' },
          { label: '品質指標設計' },
        ],
      },
      {
        label: 'データ / AI',
        valuePrefix: 'データ',
        options: [
          { label: 'データ分析' },
          { label: '機械学習モデル開発' },
          { label: 'データ基盤構築' },
          { label: 'データエンジニアリング' },
          { label: 'MLOps構築' },
        ],
      },
      {
        label: 'フルスタック',
        valuePrefix: 'フルスタック',
        options: [
          { label: 'フルスタック開発' },
          { label: '技術選定・アーキテクチャ' },
        ],
      },
    ],
  },
  {
    label: 'クリエイティブ / リサーチ',
    valuePrefix: 'クリエイティブ',
    options: [
      { label: 'UXリサーチ' },
      { label: 'UI・ビジュアルデザイン' },
      { label: 'サービスデザイン' },
      { label: 'テクニカルライティング' },
      { label: 'プロダクトブランディング' },
    ],
  },
  {
    label: 'ビジネスサポート',
    valuePrefix: 'ビジネスサポート',
    options: [
      { label: 'カスタマーサクセス' },
      { label: 'セールスエンジニア' },
      { label: '教育・オンボーディング' },
      { label: 'サポートドキュメント整備' },
      { label: 'テクニカルトレーニング' },
    ],
  },
] satisfies readonly RoleTreeCategoryInput[];

function deriveValuePrefix(label: string): string {
  const separatorIndex = label.indexOf(' / ');
  if (separatorIndex !== -1) {
    const prefix = label.slice(0, separatorIndex).trim();
    if (prefix) {
      return prefix;
    }
  }
  return label;
}

const ROLE_TREE: readonly RoleTreeCategory[] = (() => {
  let categoryIdSequence = 0;

  const build = (
    categories: readonly RoleTreeCategoryInput[],
    ancestors: readonly string[] = [],
  ): RoleTreeCategory[] => {
    const result: RoleTreeCategory[] = [];
    for (const category of categories) {
      const path = [...ancestors, category.label];
      const id = `role-category-${categoryIdSequence++}`;
      const valuePrefix = category.valuePrefix ?? deriveValuePrefix(category.label);
      const options = (category.options ?? []).map<RoleTreeOption>((option) => {
        const value = option.value ?? `${valuePrefix} / ${option.label}`;
        return { label: option.label, value };
      });
      const children = build(category.children ?? [], path);
      const allOptionValues: string[] = [];
      for (const option of options) {
        allOptionValues.push(option.value);
      }
      for (const child of children) {
        allOptionValues.push(...child.allOptionValues);
      }
      result.push({
        id,
        label: category.label,
        path,
        options,
        children,
        allOptionValues,
      });
    }
    return result;
  };

  return build(ROLE_TREE_DEFINITION) as readonly RoleTreeCategory[];
})();

const ROLE_CATEGORY_INDEX_MUTABLE = new Map<string, RoleTreeCategory>();
const ROLE_CATEGORY_VALUE_SETS_MUTABLE = new Map<string, ReadonlySet<string>>();

(function register(categories: readonly RoleTreeCategory[]): void {
  for (const category of categories) {
    ROLE_CATEGORY_INDEX_MUTABLE.set(category.id, category);
    ROLE_CATEGORY_VALUE_SETS_MUTABLE.set(category.id, new Set(category.allOptionValues));
    if (category.children.length) {
      register(category.children);
    }
  }
})(ROLE_TREE);

const ROLE_CATEGORY_INDEX = ROLE_CATEGORY_INDEX_MUTABLE as ReadonlyMap<string, RoleTreeCategory>;
const ROLE_CATEGORY_VALUE_SETS = ROLE_CATEGORY_VALUE_SETS_MUTABLE as ReadonlyMap<
  string,
  ReadonlySet<string>
>;
const ROLE_CATEGORY_OPTION_TOTALS = new Map(
  Array.from(ROLE_CATEGORY_VALUE_SETS_MUTABLE.entries(), ([id, values]) => [id, values.size]),
) as ReadonlyMap<string, number>;
const ALL_CATEGORY_IDS = Array.from(ROLE_CATEGORY_INDEX.keys());
const EMPTY_CATEGORY_SELECTION = new Map<string, number>();

function flattenRoleOptions(
  categories: readonly RoleTreeCategory[],
  ancestorLabels: readonly string[] = [],
  ancestorIds: readonly string[] = [],
): RoleOptionDescriptor[] {
  const result: RoleOptionDescriptor[] = [];
  for (const category of categories) {
    const lineageLabels = [...ancestorLabels, category.label];
    const lineageIds = [...ancestorIds, category.id];
    if (category.options.length) {
      for (const option of category.options) {
        result.push({ ...option, groups: lineageLabels, categoryIds: lineageIds });
      }
    }
    if (category.children.length) {
      result.push(...flattenRoleOptions(category.children, lineageLabels, lineageIds));
    }
  }
  return result;
}

const ROLE_OPTIONS = flattenRoleOptions(ROLE_TREE);
const ROLE_OPTION_LOOKUP = new Map(ROLE_OPTIONS.map((option) => [option.value, option] as const));

const MAX_NICKNAME_LENGTH = 30;
const MAX_BIO_LENGTH = 500;
const MAX_EXPERIENCE_YEARS = 50;
const MAX_ROLES = 5;
const MAX_CUSTOM_ROLE_LENGTH = 32;
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-profile-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-dialog.html',
  styleUrl: './profile-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileDialogComponent implements AfterViewInit {
  @Output() public readonly dismiss = new EventEmitter<void>();
  @Output() public readonly profileSaved = new EventEmitter<UserProfile>();

  @ViewChild('panel', { static: true }) private readonly panel?: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') private readonly fileInput?: ElementRef<HTMLInputElement>;

  private readonly profileService = inject(ProfileService);

  public readonly roleCategories = ROLE_TREE;
  public readonly maxBioLength = MAX_BIO_LENGTH;
  public readonly maxCustomRoleLength = MAX_CUSTOM_ROLE_LENGTH;
  public readonly maxRoles = MAX_ROLES;

  public readonly form = createSignalForm<ProfileFormState>({
    nickname: '',
    experienceYears: null,
    roles: [],
    bio: '',
  });

  private readonly loadingStore = signal(true);
  private readonly savingStore = signal(false);
  private readonly errorStore = signal<string | null>(null);
  private readonly roleErrorStore = signal<string | null>(null);
  private readonly customRoleInputStore = signal('');
  private readonly customRoleErrorStore = signal<string | null>(null);
  private readonly nicknameTouched = signal(false);
  private readonly experienceTouched = signal(false);
  private readonly bioTouched = signal(false);
  private readonly initialValueStore = signal<ProfileFormState | null>(null);
  private readonly avatarPreviewStore = signal<string | null>(null);
  private readonly avatarFileStore = signal<File | null>(null);
  private readonly removeAvatarStore = signal(false);
  private readonly expandedCategoriesStore = signal<ReadonlySet<string>>(new Set(ALL_CATEGORY_IDS));

  public readonly loading = computed(() => this.loadingStore());
  public readonly saving = computed(() => this.savingStore());
  public readonly error = computed(() => this.errorStore());
  public readonly rolesError = computed(() => this.roleErrorStore());
  public readonly customRoleInput = computed(() => this.customRoleInputStore());
  public readonly customRoleError = computed(() => this.customRoleErrorStore());
  public readonly expandedCategories = computed(() => this.expandedCategoriesStore());
  public readonly selectedRoleCount = computed(() => this.form.controls.roles.value().length);
  public readonly selectedRoleDetails = computed<readonly SelectedRoleDetail[]>(() => {
    const roles = this.form.controls.roles.value();
    return roles.map<SelectedRoleDetail>((role) => {
      const option = ROLE_OPTION_LOOKUP.get(role);
      if (!option) {
        return { value: role, label: role, groups: [], isCustom: true };
      }
      return {
        value: option.value,
        label: option.label,
        groups: option.groups,
        isCustom: false,
      };
    });
  });
  public readonly categorySelectionCounts = computed(() => {
    const roles = this.form.controls.roles.value();
    if (!roles.length) {
      return EMPTY_CATEGORY_SELECTION;
    }

    const selected = new Set(roles);
    const entries: [string, number][] = [];

    for (const [categoryId, values] of ROLE_CATEGORY_VALUE_SETS) {
      let count = 0;
      for (const value of values) {
        if (selected.has(value)) {
          count += 1;
        }
      }
      if (count > 0) {
        entries.push([categoryId, count]);
      }
    }

    return new Map(entries);
  });
  public readonly roleCategoryOptionTotals = ROLE_CATEGORY_OPTION_TOTALS;
  public readonly avatarPreview = computed(() => this.avatarPreviewStore());
  public readonly avatarSelected = computed(
    () => this.avatarFileStore() !== null || this.avatarPreviewStore() !== null,
  );

  public readonly nicknameError = computed(() => {
    if (!this.nicknameTouched()) {
      return null;
    }

    const value = this.form.controls.nickname.value().trim();
    if (!value) {
      return 'ニックネームを入力してください。';
    }
    if (value.length > MAX_NICKNAME_LENGTH) {
      return `ニックネームは${MAX_NICKNAME_LENGTH}文字以内で入力してください。`;
    }
    return null;
  });

  public readonly experienceError = computed(() => {
    if (!this.experienceTouched()) {
      return null;
    }

    const value = this.form.controls.experienceYears.value();
    if (value === null) {
      return null;
    }

    if (!Number.isInteger(value) || value < 0 || value > MAX_EXPERIENCE_YEARS) {
      return `経験年数は0から${MAX_EXPERIENCE_YEARS}の整数で入力してください。`;
    }

    return null;
  });

  public readonly bioError = computed(() => {
    if (!this.bioTouched()) {
      return null;
    }

    const length = this.form.controls.bio.value().trim().length;
    if (length > MAX_BIO_LENGTH) {
      return `自己紹介は${MAX_BIO_LENGTH}文字以内で入力してください。`;
    }
    return null;
  });

  public readonly hasValidationErrors = computed(() =>
    Boolean(
      this.nicknameError() ||
        this.experienceError() ||
        this.bioError() ||
        this.rolesError(),
    ),
  );

  public readonly experienceDisplay = computed(() => {
    const value = this.form.controls.experienceYears.value();
    return value === null ? '' : String(value);
  });

  public readonly bioLength = computed(() => this.form.controls.bio.value().trim().length);

  public readonly isDirty = computed(() => {
    const initial = this.initialValueStore();
    if (!initial) {
      return false;
    }

    const current = this.form.value();
    if (initial.nickname !== current.nickname) {
      return true;
    }
    if (initial.experienceYears !== current.experienceYears) {
      return true;
    }
    if (initial.bio !== current.bio) {
      return true;
    }
    if (!this.areRolesEqual(initial.roles, current.roles)) {
      return true;
    }
    if (this.avatarFileStore() !== null) {
      return true;
    }
    if (this.removeAvatarStore()) {
      return true;
    }
    return false;
  });

  public readonly canSubmit = computed(
    () => !this.loading() && !this.saving() && this.isDirty() && !this.hasValidationErrors(),
  );

  public constructor() {
    void this.loadProfile();
  }

  public ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.panel?.nativeElement.focus();
    });
  }

  @HostListener('document:keydown', ['$event'])
  public onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    this.handleDismissRequest();
  }

  public onBackdropClick(): void {
    this.handleDismissRequest();
  }

  public onCancelClick(): void {
    this.handleDismissRequest();
  }

  public async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.nicknameTouched.set(true);
    this.experienceTouched.set(true);
    this.bioTouched.set(true);
    this.errorStore.set(null);

    if (!this.canSubmit()) {
      if (this.hasValidationErrors()) {
        this.errorStore.set('入力内容に誤りがあります。赤字の項目を修正してください。');
      }
      return;
    }

    const value = this.form.value();
    const payload: ProfileUpdatePayload = {
      nickname: value.nickname.trim(),
      experienceYears: value.experienceYears,
      roles: [...value.roles],
      bio: value.bio,
      removeAvatar: this.removeAvatarStore(),
      avatarFile: this.avatarFileStore(),
    };

    this.savingStore.set(true);

    try {
      const profile = await firstValueFrom(this.profileService.update(payload));
      this.applyProfile(profile);
      this.profileSaved.emit(profile);
      this.dismiss.emit();
    } catch (error) {
      console.error(error);
      this.errorStore.set('プロフィールの更新に失敗しました。時間をおいて再度お試しください。');
    } finally {
      this.savingStore.set(false);
    }
  }

  public onNicknameInput(event: Event): void {
    this.nicknameTouched.set(true);
    this.errorStore.set(null);
    const target = event.target as HTMLInputElement | null;
    const value = target?.value ?? '';
    this.form.controls.nickname.setValue(value);
  }

  public onExperienceInput(event: Event): void {
    this.experienceTouched.set(true);
    const target = event.target as HTMLInputElement | null;
    const raw = target?.value ?? '';
    if (raw === '') {
      this.form.controls.experienceYears.setValue(null);
      return;
    }

    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      this.form.controls.experienceYears.setValue(null);
      return;
    }

    this.form.controls.experienceYears.setValue(parsed);
  }

  public onBioInput(event: Event): void {
    this.bioTouched.set(true);
    const target = event.target as HTMLTextAreaElement | null;
    const value = target?.value ?? '';
    this.form.controls.bio.setValue(value);
  }

  public onCustomRoleInput(event: Event): void {
    this.customRoleErrorStore.set(null);
    const target = event.target as HTMLInputElement | null;
    const value = target?.value ?? '';
    this.customRoleInputStore.set(value);
  }

  public onCustomRoleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    this.onCustomRoleAdd();
  }

  public onCustomRoleAdd(): void {
    const value = this.customRoleInputStore().trim();
    if (!value) {
      this.customRoleErrorStore.set('担当領域を入力してください。');
      return;
    }

    if (value.length > MAX_CUSTOM_ROLE_LENGTH) {
      this.customRoleErrorStore.set(
        `担当領域は${MAX_CUSTOM_ROLE_LENGTH}文字以内で入力してください。`,
      );
      return;
    }

    if (ROLE_OPTION_LOOKUP.has(value)) {
      this.customRoleErrorStore.set(
        '同名の選択肢が存在します。チェックボックスから選択してください。',
      );
      return;
    }

    const roles = this.form.controls.roles.value();
    if (roles.includes(value)) {
      this.customRoleErrorStore.set('同じ担当領域がすでに選択されています。');
      return;
    }

    if (roles.length >= MAX_ROLES) {
      this.customRoleErrorStore.set(
        `業務内容は最大${MAX_ROLES}件まで選択できます。選択済みの項目を解除してから追加してください。`,
      );
      return;
    }

    this.form.controls.roles.setValue([...roles, value]);
    this.customRoleInputStore.set('');
    this.customRoleErrorStore.set(null);
    this.roleErrorStore.set(null);
  }

  public onCategoryToggle(categoryId: string): void {
    this.expandedCategoriesStore.update((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  public onRoleToggle(role: string): void {
    const roles = this.form.controls.roles.value();
    if (roles.includes(role)) {
      const filtered = roles.filter((item) => item !== role);
      this.form.controls.roles.setValue(filtered);
      this.roleErrorStore.set(null);
      this.customRoleErrorStore.set(null);
      return;
    }

    if (roles.length >= MAX_ROLES) {
      this.roleErrorStore.set(`業務内容は最大${MAX_ROLES}件まで選択できます。`);
      return;
    }

    this.roleErrorStore.set(null);
    this.customRoleErrorStore.set(null);
    this.form.controls.roles.setValue([...roles, role]);
  }

  public onRoleRemove(role: string): void {
    const roles = this.form.controls.roles.value();
    if (!roles.includes(role)) {
      return;
    }

    const filtered = roles.filter((item) => item !== role);
    this.form.controls.roles.setValue(filtered);
    this.roleErrorStore.set(null);
    this.customRoleErrorStore.set(null);
  }

  public triggerAvatarPicker(): void {
    this.errorStore.set(null);
    this.fileInput?.nativeElement.click();
  }

  public async onAvatarChange(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.[0];
    if (!file) {
      return;
    }

    if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
      this.errorStore.set('アイコン画像は PNG / JPEG / WebP 形式のファイルを選択してください。');
      this.resetFileInput();
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      this.errorStore.set('アイコン画像は5MB以内のファイルを選択してください。');
      this.resetFileInput();
      return;
    }

    try {
      const preview = await this.readFile(file);
      this.avatarFileStore.set(file);
      this.removeAvatarStore.set(false);
      this.avatarPreviewStore.set(preview);
      this.resetFileInput();
    } catch {
      this.errorStore.set('画像の読み込みに失敗しました。別のファイルをお試しください。');
    }
  }

  public onAvatarRemove(): void {
    this.avatarFileStore.set(null);
    this.avatarPreviewStore.set(null);
    this.removeAvatarStore.set(true);
    this.resetFileInput();
  }

  private async loadProfile(): Promise<void> {
    this.loadingStore.set(true);
    this.errorStore.set(null);
    try {
      const profile = await firstValueFrom(this.profileService.fetch());
      this.applyProfile(profile);
    } catch (error) {
      console.error(error);
      this.errorStore.set('プロフィール情報の取得に失敗しました。時間をおいて再度お試しください。');
    } finally {
      this.loadingStore.set(false);
    }
  }

  private applyProfile(profile: UserProfile): void {
    const state: ProfileFormState = {
      nickname: profile.nickname ?? '',
      experienceYears: profile.experience_years ?? null,
      roles: [...profile.roles],
      bio: profile.bio ?? '',
    };

    this.form.reset({ ...state, roles: [...state.roles] });
    this.initialValueStore.set({ ...state, roles: [...state.roles] });
    this.avatarPreviewStore.set(profile.avatar_url);
    this.avatarFileStore.set(null);
    this.removeAvatarStore.set(false);
    this.nicknameTouched.set(false);
    this.experienceTouched.set(false);
    this.bioTouched.set(false);
    this.roleErrorStore.set(null);
    this.customRoleInputStore.set('');
    this.customRoleErrorStore.set(null);
  }

  private handleDismissRequest(): void {
    if (this.saving()) {
      return;
    }

    if (this.isDirty()) {
      if (typeof window !== 'undefined') {
        const confirmed = window.confirm('保存されていない変更があります。破棄して閉じますか？');
        if (!confirmed) {
          return;
        }
      }
    }

    this.dismiss.emit();
  }

  private areRolesEqual(first: readonly string[], second: readonly string[]): boolean {
    if (first.length !== second.length) {
      return false;
    }

    return first.every((role, index) => role === second[index]);
  }

  private resetFileInput(): void {
    if (!this.fileInput) {
      return;
    }

    this.fileInput.nativeElement.value = '';
  }

  private async readFile(file: File): Promise<string> {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === 'string' ? reader.result : '');
      };
      reader.onerror = (event) => {
        console.error(event);
        reject(event);
      };
      reader.readAsDataURL(file);
    });
  }
}
