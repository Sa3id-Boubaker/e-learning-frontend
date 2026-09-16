import { FormControl } from '@angular/forms';

import { AdminUserResponse } from './models/admin-user.models';

/**
 * Partagé par CourseEnrollmentFormModalComponent et TrainingEnrollmentFormModalComponent, dont
 * selectStudent() et le début de submit() étaient identiques au caractère près (code dupliqué
 * signalé par SonarQube). Fonctions pures (pas de service) : chaque composant garde son propre
 * studentSearchControl / selectedStudent, il n'y a pas d'état partagé.
 */

/** Applique la sélection d'un résultat de recherche : remplit le champ avec le nom complet
 *  sans redéclencher la recherche debounced (emitEvent: false). */
export function applyStudentPick(searchControl: FormControl<string>, student: AdminUserResponse): void {
  searchControl.setValue(`${student.firstName} ${student.lastName}`, { emitEvent: false });
}

/**
 * Retourne l'étudiant sélectionné si le formulaire est soumissible, sinon null. Centralise la
 * vérification canSubmit + non-null pour que l'appelant récupère un AdminUserResponse
 * correctement "narrowed" (et non AdminUserResponse | null) — remplace le garde-fou manuel
 * qui existait précédemment dans chaque submit().
 */
export function requireSelectedStudent(canSubmit: boolean, selectedStudent: AdminUserResponse | null): AdminUserResponse | null {
  return canSubmit && selectedStudent ? selectedStudent : null;
}
