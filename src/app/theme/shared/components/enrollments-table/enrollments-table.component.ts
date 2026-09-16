import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Table "enrolled students" partagée par CourseEnrolledStudentsComponent et
 * TrainingEnrolledStudentsComponent (marquage identique dans les deux templates, signalé
 * comme code dupliqué par SonarQube). Contient la structure <table> complète (wrapper
 * .table-responsive, <caption>, <thead>) ; les lignes <tr> du <tbody> sont projetées via
 * <ng-content> depuis chaque page appelante.
 *
 * Important : la structure <table>/<caption>/<thead>/<tbody> doit rester ENTIÈREMENT dans ce
 * seul fichier. Le sensor HTML de SonarQube analyse chaque fichier .html isolément : une
 * première version de ce composant scindait <table> (dans la page appelante) et <caption>/
 * <thead> (ici) via un sélecteur d'attribut, ce qui faisait croire à Sonar que la table
 * n'avait ni légende ni en-tête et déclenchait à tort Web:S5256 / Web:TableWithoutCaptionCheck
 * (10 bugs New Code). Sélecteur d'élément + <ng-content> au lieu d'un sélecteur d'attribut sur
 * <table> : corrige ça tout en gardant la déduplication.
 */
@Component({
  selector: 'app-enrollments-table',
  imports: [TranslatePipe],
  templateUrl: './enrollments-table.component.html'
})
export class EnrollmentsTableComponent {}
