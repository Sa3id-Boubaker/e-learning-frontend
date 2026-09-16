import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * <caption> + <thead> partagés par CourseEnrolledStudentsComponent et
 * TrainingEnrolledStudentsComponent (marquage identique dans les deux templates, signalé
 * comme code dupliqué par SonarQube). Sélecteur d'attribut sur <table> : ajoute simplement
 * appEnrollmentsTableHead à la balise <table> existante, le <tbody> reste projeté tel quel.
 */
@Component({
  selector: 'table[appEnrollmentsTableHead]',
  imports: [TranslatePipe],
  templateUrl: './enrollments-table.component.html'
})
export class EnrollmentsTableHeadComponent {}
