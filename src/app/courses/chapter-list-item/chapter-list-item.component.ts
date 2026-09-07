import { ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { finalize } from 'rxjs';

import { IconService } from '@ant-design/icons-angular';
import {
  CheckOutline,
  DeleteOutline,
  EditOutline,
  LockOutline,
  PlayCircleOutline,
  PlusOutline,
  RightOutline,
  VideoCameraOutline
} from '@ant-design/icons-angular/icons';
import { TranslateService } from '@ngx-translate/core';

import { ApiErrorResponse, UserProfileResponse } from '../../auth/models/auth.models';
import { SharedModule } from '../../theme/shared/shared.module';
import { ToastService } from '../../theme/shared/components/toast/toast.service';
import { DeleteConfirmationModalComponent } from '../../theme/shared/components/delete-confirmation-modal/delete-confirmation-modal.component';
import { canManageCourse } from '../course-permissions';
import { formatDuration } from '../format-duration';
import { formatTotalDuration } from '../format-total-duration';
import { ChapterResponse } from '../models/chapter.models';
import { CourseResponse } from '../models/course.models';
import { VideoResponse } from '../models/video.models';
import { VideoFormModalComponent, VideoFormModalMode } from '../video-form-modal/video-form-modal.component';
import { VideoPlayerModalComponent } from '../video-player-modal/video-player-modal.component';
import { VideoService } from '../video.service';

@Component({
  selector: 'app-chapter-list-item',
  imports: [SharedModule, VideoFormModalComponent, DeleteConfirmationModalComponent, VideoPlayerModalComponent],
  templateUrl: './chapter-list-item.component.html',
  styleUrl: './chapter-list-item.component.scss'
})
export class ChapterListItemComponent {
  private readonly videoService = inject(VideoService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iconService = inject(IconService);
  private readonly translateService = inject(TranslateService);

  @Input({ required: true }) chapter!: ChapterResponse;
  @Input() chapterIndex = 0;
  @Input() course: CourseResponse | null = null;
  @Input() currentUser: UserProfileResponse | null = null;
  @Input() videos: VideoResponse[] = [];
  @Input() courseId = '';
  @Input() isStudent = false;
  @Input() completedVideoIds: Set<string> = new Set<string>();

  @Output() readonly editChapter = new EventEmitter<ChapterResponse>();
  @Output() readonly deleteChapter = new EventEmitter<ChapterResponse>();
  /** Emitted once the backend confirms a video's completion — the parent owns the aggregate progress state. */
  @Output() readonly videoCompleted = new EventEmitter<string>();

  readonly formatDuration = formatDuration;

  expanded = false;

  videoFormModalOpen = false;
  videoFormMode: VideoFormModalMode = 'create';
  selectedVideo: VideoResponse | null = null;

  videoDeleteModalOpen = false;
  videoPendingDelete: VideoResponse | null = null;
  videoDeleteLoading = false;

  playerModalOpen = false;
  playingVideo: VideoResponse | null = null;

  constructor() {
    this.iconService.addIcon(
      ...[EditOutline, DeleteOutline, PlusOutline, RightOutline, PlayCircleOutline, VideoCameraOutline, CheckOutline, LockOutline]
    );
  }

  get canManage(): boolean {
    return !!this.course && canManageCourse(this.course, this.currentUser);
  }

  get nextVideoOrder(): number {
    return this.videos.length + 1;
  }

  get videoDeleteModalTitle(): string {
    return this.videoPendingDelete
      ? this.translateService.instant('courses.chapterItem.deleteVideoTitleNamed', { title: this.videoPendingDelete.title })
      : this.translateService.instant('courses.chapterItem.deleteVideoTitleGeneric');
  }

  get chapterDurationSeconds(): number {
    return this.videos.reduce((total, video) => total + (video.duration ?? 0), 0);
  }

  get completedCountInChapter(): number {
    return this.videos.reduce((count, video) => count + (this.completedVideoIds.has(video.id) ? 1 : 0), 0);
  }

  get chapterSubtitle(): string {
    if (this.videos.length === 0) {
      return this.translateService.instant('courses.chapterItem.noVideosYet');
    }

    const duration = formatTotalDuration(this.chapterDurationSeconds);

    if (this.isStudent) {
      return this.translateService.instant('courses.chapterItem.completedCountOfTotal', {
        completed: this.completedCountInChapter,
        total: this.videos.length,
        duration
      });
    }

    const key = this.videos.length === 1 ? 'courses.chapterItem.videoCountSingular' : 'courses.chapterItem.videoCountPlural';
    return this.translateService.instant(key, { count: this.videos.length, duration });
  }

  isVideoCompleted(video: VideoResponse): boolean {
    return this.completedVideoIds.has(video.id);
  }

  isVideoLocked(video: VideoResponse): boolean {
    return !video.videoUrl;
  }

  toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  onVideoRowClick(video: VideoResponse): void {
    if (this.isVideoLocked(video)) {
      this.toastService.info(this.translateService.instant('courses.chapterItem.enrollToWatch'));
      return;
    }

    this.openPlayer(video);
  }

  openPlayer(video: VideoResponse): void {
    this.playingVideo = video;
    this.playerModalOpen = true;
  }

  onPlayerClosed(): void {
    this.playerModalOpen = false;
    this.playingVideo = null;
  }

  /** The player modal owns the actual markVideoComplete call — this just forwards the confirmed id upward. */
  onVideoCompletedInPlayer(videoId: string): void {
    this.videoCompleted.emit(videoId);
  }

  openCreateVideoModal(): void {
    this.videoFormMode = 'create';
    this.selectedVideo = null;
    this.videoFormModalOpen = true;
  }

  openEditVideoModal(video: VideoResponse): void {
    this.videoFormMode = 'edit';
    this.selectedVideo = video;
    this.videoFormModalOpen = true;
  }

  onVideoFormModalClosed(): void {
    this.videoFormModalOpen = false;
  }

  onVideoSaved(video: VideoResponse): void {
    if (this.videoFormMode === 'create') {
      this.videos = [...this.videos, video].sort((a, b) => a.order - b.order);
    } else {
      this.videos = this.videos.map((existing) => (existing.id === video.id ? video : existing)).sort((a, b) => a.order - b.order);
    }

    this.videoFormModalOpen = false;
    this.cdr.markForCheck();
  }

  onVideoFormConflict(): void {
    this.videoFormModalOpen = false;
  }

  openDeleteVideoModal(video: VideoResponse): void {
    this.videoPendingDelete = video;
    this.videoDeleteModalOpen = true;
  }

  onVideoDeleteModalClosed(): void {
    if (this.videoDeleteLoading) {
      return;
    }

    this.videoDeleteModalOpen = false;
    this.videoPendingDelete = null;
  }

  confirmDeleteVideo(): void {
    if (!this.videoPendingDelete || this.videoDeleteLoading) {
      return;
    }

    this.videoDeleteLoading = true;
    const video = this.videoPendingDelete;

    this.videoService
      .deleteVideo(video.id)
      .pipe(
        finalize(() => {
          this.videoDeleteLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.toastService.success(this.translateService.instant('courses.chapterItem.videoDeleted'));
          this.videos = this.videos.filter((existing) => existing.id !== video.id);
          this.videoDeleteModalOpen = false;
          this.videoPendingDelete = null;
        },
        error: (error) => {
          const status = error?.status as number | undefined;

          if (status === 401) {
            return;
          }

          const apiError = error?.error as ApiErrorResponse | undefined;
          this.toastService.error(apiError?.message ?? this.translateService.instant('courses.chapterItem.deleteVideoError'));
        }
      });
  }
}
