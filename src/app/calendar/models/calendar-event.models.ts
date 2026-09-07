import { LiveSessionStatus } from '../../trainings/models/live-session.models';

export interface CalendarEventResponse {
  // id and sessionId are always identical — id exists specifically so it maps straight onto
  // FullCalendar's event.id.
  id: string;
  trainingId: string;
  sessionId: string;
  trainingTitle: string;
  sessionTitle: string;
  description: string;
  startAt: string;
  endAt: string;
  status: LiveSessionStatus;
  // Optional now — instructors can schedule a session before the meeting link exists.
  meetingUrl: string | null;
  hasRecording: boolean;
}
