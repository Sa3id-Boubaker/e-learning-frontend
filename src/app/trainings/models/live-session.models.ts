export type LiveSessionStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';

export interface LiveSessionResponse {
  id: string;
  trainingId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  // Optional now — instructors can schedule a session before the meeting link exists.
  meetingUrl: string | null;
  status: LiveSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LiveSessionCreateRequest {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  meetingUrl?: string;
  status: LiveSessionStatus;
}

export interface LiveSessionUpdateRequest {
  title?: string;
  description?: string;
  startAt?: string;
  endAt?: string;
  meetingUrl?: string;
  status?: LiveSessionStatus;
}
