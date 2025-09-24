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

const ROLE_OPTIONS: readonly string[] = [
  'Java',
  'フロント',
  'バックエンド',
  'PMO',
  'インフラ',
  'QA',
  'データ分析',
  'その他',
];

const LOCATION_OPTIONS: readonly string[] = [
  '未設定',
  '北海道',
  '青森県',
  '岩手県',
  '宮城県',
  '秋田県',
  '山形県',
  '福島県',
  '茨城県',
  '栃木県',
  '群馬県',
  '埼玉県',
  '千葉県',
  '東京都',
  '神奈川県',
  '新潟県',
  '富山県',
  '石川県',
  '福井県',
  '山梨県',
  '長野県',
  '岐阜県',
  '静岡県',
  '愛知県',
  '三重県',
  '滋賀県',
  '京都府',
  '大阪府',
  '兵庫県',
  '奈良県',
  '和歌山県',
  '鳥取県',
  '島根県',
  '岡山県',
  '広島県',
  '山口県',
  '徳島県',
  '香川県',
  '愛媛県',
  '高知県',
  '福岡県',
  '佐賀県',
  '長崎県',
  '熊本県',
  '大分県',
  '宮崎県',
  '鹿児島県',
  '沖縄県',
  '海外',
];

const MAX_NICKNAME_LENGTH = 30;
const MAX_BIO_LENGTH = 500;
const MAX_PORTFOLIO_LENGTH = 255;
const MAX_EXPERIENCE_YEARS = 50;
const MAX_ROLES = 5;
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

  public readonly roleOptions = ROLE_OPTIONS;
  public readonly locationOptions = LOCATION_OPTIONS;
  public readonly maxBioLength = MAX_BIO_LENGTH;

  public readonly form = createSignalForm<ProfileFormState>({
    nickname: '',
    experienceYears: null,
    roles: [],
    bio: '',
    location: '',
    portfolioUrl: '',
  });

  private readonly loadingStore = signal(true);
  private readonly savingStore = signal(false);
  private readonly errorStore = signal<string | null>(null);
  private readonly roleErrorStore = signal<string | null>(null);
  private readonly nicknameTouched = signal(false);
  private readonly experienceTouched = signal(false);
  private readonly bioTouched = signal(false);
  private readonly portfolioTouched = signal(false);
  private readonly initialValueStore = signal<ProfileFormState | null>(null);
  private readonly avatarPreviewStore = signal<string | null>(null);
  private readonly avatarFileStore = signal<File | null>(null);
  private readonly removeAvatarStore = signal(false);

  public readonly loading = computed(() => this.loadingStore());
  public readonly saving = computed(() => this.savingStore());
  public readonly error = computed(() => this.errorStore());
  public readonly rolesError = computed(() => this.roleErrorStore());
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

  public readonly portfolioError = computed(() => {
    if (!this.portfolioTouched()) {
      return null;
    }

    const value = this.form.controls.portfolioUrl.value().trim();
    if (!value) {
      return null;
    }

    if (value.length > MAX_PORTFOLIO_LENGTH) {
      return `ポートフォリオURLは${MAX_PORTFOLIO_LENGTH}文字以内で入力してください。`;
    }

    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return 'ポートフォリオURLは http または https で始まる必要があります。';
      }
    } catch {
      return '有効なURLを入力してください。';
    }

    return null;
  });

  public readonly hasValidationErrors = computed(
    () =>
      Boolean(
        this.nicknameError() ||
          this.experienceError() ||
          this.bioError() ||
          this.portfolioError() ||
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
    if (initial.location !== current.location) {
      return true;
    }
    if (initial.portfolioUrl !== current.portfolioUrl) {
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
    this.portfolioTouched.set(true);
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
      location: value.location,
      portfolioUrl: value.portfolioUrl,
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

  public onLocationChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const value = target?.value ?? '';
    this.form.controls.location.setValue(value === '未設定' ? '' : value);
  }

  public onPortfolioInput(event: Event): void {
    this.portfolioTouched.set(true);
    const target = event.target as HTMLInputElement | null;
    const value = target?.value ?? '';
    this.form.controls.portfolioUrl.setValue(value);
  }

  public onRoleToggle(role: string): void {
    const roles = this.form.controls.roles.value();
    if (roles.includes(role)) {
      const filtered = roles.filter((item) => item !== role);
      this.form.controls.roles.setValue(filtered);
      this.roleErrorStore.set(null);
      return;
    }

    if (roles.length >= MAX_ROLES) {
      this.roleErrorStore.set(`業務内容は最大${MAX_ROLES}件まで選択できます。`);
      return;
    }

    this.roleErrorStore.set(null);
    this.form.controls.roles.setValue([...roles, role]);
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
      location: profile.location ?? '',
      portfolioUrl: profile.portfolio_url ?? '',
    };

    this.form.reset({ ...state, roles: [...state.roles] });
    this.initialValueStore.set({ ...state, roles: [...state.roles] });
    this.avatarPreviewStore.set(profile.avatar_url);
    this.avatarFileStore.set(null);
    this.removeAvatarStore.set(false);
    this.nicknameTouched.set(false);
    this.experienceTouched.set(false);
    this.bioTouched.set(false);
    this.portfolioTouched.set(false);
    this.roleErrorStore.set(null);
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
