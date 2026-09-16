import { ChangeDetectorRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { finalize, Observable } from 'rxjs';

import { AdminUserResponse } from './models/admin-user.models';

/**
 * Partagé par CourseEnrollmentFormModalComponent et TrainingEnrollmentFormModalComponent.
 * Les deux versions précédentes de ce fichier (extraction simple, puis submitEnrollment<T>()
 * générique) réduisaient la duplication SonarQube sans l'éliminer : même déléguant à des
 * fonctions partagées, le POINT D'APPEL (selectStudent(), la fin de submit()) restait, lui,
 * identique au caractère près entre les deux composants — et CPD compare du texte, pas de la
 * logique. Cette version va plus loin : selectStudent() est défini UNE SEULE FOIS (dans
 * StudentSearchFormBase ci-dessous, hérité par les deux composants) et submitEnrollment()
 * absorbe aussi le routage next/error/finalize (created.emit / handleCreateError / cdr), donc
 * il ne reste plus, dans chaque composant, qu'une ligne de submit() qui diffère réellement
 * (nom du champ, service appelé) — aucun texte identique ne subsiste entre les deux fichiers.
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

/**
 * Classe de base pour les modales "New enrollment" (Course/Training) : les deux ont besoin du
 * même selectStudent() (délègue à pickStudent()). Le définir une seule fois ici, plutôt que de
 * répéter la méthode dans chaque composant, est ce qui la sort du calcul de lignes dupliquées de
 * SonarQube — un texte qui n'existe qu'à un seul endroit ne peut pas être "dupliqué".
 * Le paramètre `this: StudentSearchHost` évite d'imposer des champs abstraits : au moment de
 * l'appel, TypeScript vérifie juste que la sous-classe concrète a bien la forme StudentSearchHost
 * (ce qui est déjà le cas de CourseEnrollmentFormModalComponent / TrainingEnrollmentFormModalComponent).
 */
export abstract class StudentSearchFormBase {
  selectStudent(this: StudentSearchHost, student: AdminUserResponse): void {
    pickStudent(this, student);
  }
}

export interface EnrollmentSubmitHost<T> {
  readonly canSubmit: boolean;
  readonly selectedStudent: AdminUserResponse | null;
  serverMessage: string;
  submitting: boolean;
  readonly created: { emit(value: T): void };
  readonly cdr: ChangeDetectorRef;
  handleCreateError(error: unknown): void;
}

/**
 * Vérifie que le formulaire est soumissible (garde + narrowing de selectedStudent), réinitialise
 * serverMessage/submitting, délègue la création au service fourni par l'appelant, puis route
 * lui-même next → created.emit(), error → handleCreateError(), et finalize → submitting=false +
 * cdr.markForCheck(). L'appelant n'a donc plus qu'à fournir la fonction de création (spécifique
 * à courseId/trainingId et au service) — plus aucun callback boilerplate à recopier.
 */
export function submitEnrollment<T>(host: EnrollmentSubmitHost<T>, createEnrollment: (studentId: string) => Observable<T>): void {
  const student = host.canSubmit && host.selectedStudent ? host.selectedStudent : null;

  if (!student) {
    return;
  }

  host.serverMessage = '';
  host.submitting = true;

  createEnrollment(student.id)
    .pipe(
      finalize(() => {
        host.submitting = false;
        host.cdr.markForCheck();
      })
    )
    .subscribe({
      next: (result) => host.created.emit(result),
      error: (error) => host.handleCreateError(error)
    });
}
