import { FormControl } from '@angular/forms';
import { finalize, Observable } from 'rxjs';

import { AdminUserResponse } from './models/admin-user.models';

/**
 * Partagé par CourseEnrollmentFormModalComponent et TrainingEnrollmentFormModalComponent.
 * selectStudent() et le début de submit() (garde + reset + appel service + finalize + subscribe)
 * étaient identiques au caractère près entre les deux composants — signalé comme code dupliqué
 * par SonarQube, y compris après une première extraction en fonctions séparées (le point d'appel
 * restait, lui, toujours identique). Cette version absorbe tout le squelette commun ; seule la
 * logique propre à chaque page (nom du champ courseId/trainingId, service appelé) reste dans le
 * composant, injectée via une closure.
 *
 * Fonctions pures/génériques (pas de service) : chaque composant garde son propre
 * studentSearchControl / selectedStudent, il n'y a pas d'état partagé.
 */

export interface StudentSearchHost {
  selectedStudent: AdminUserResponse | null;
  readonly studentSearchControl: FormControl<string>;
  studentResultsOpen: boolean;
  studentResults: AdminUserResponse[];
}

/** Applique la sélection d'un résultat de recherche : remplit le champ avec le nom complet
 *  sans redéclencher la recherche debounced (emitEvent: false), ferme la liste des résultats. */
export function pickStudent(host: StudentSearchHost, student: AdminUserResponse): void {
  host.selectedStudent = student;
  host.studentSearchControl.setValue(`${student.firstName} ${student.lastName}`, { emitEvent: false });
  host.studentResultsOpen = false;
  host.studentResults = [];
}

export interface EnrollmentSubmitHost {
  readonly canSubmit: boolean;
  readonly selectedStudent: AdminUserResponse | null;
  serverMessage: string;
  submitting: boolean;
}

/**
 * Vérifie que le formulaire est soumissible (garde + narrowing de selectedStudent), réinitialise
 * serverMessage/submitting, puis délègue la création au service fourni par l'appelant et route
 * next/error/finalize vers les callbacks fournis. Ne fait rien (aucun appel réseau) si le
 * formulaire n'est pas soumissible.
 */
export function submitEnrollment<T>(
  host: EnrollmentSubmitHost,
  createEnrollment: (studentId: string) => Observable<T>,
  onSuccess: (result: T) => void,
  onError: (error: unknown) => void,
  onSettled: () => void
): void {
  const student = host.canSubmit && host.selectedStudent ? host.selectedStudent : null;

  if (!student) {
    return;
  }

  host.serverMessage = '';
  host.submitting = true;

  createEnrollment(student.id)
    .pipe(finalize(onSettled))
    .subscribe({ next: onSuccess, error: onError });
}
