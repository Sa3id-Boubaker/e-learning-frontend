// angular import
import { Component, DestroyRef, Input, OnInit, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// project import
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

// third party
import { NgApexchartsModule, ChartComponent, ApexOptions } from 'ng-apexcharts';

@Component({
  selector: 'app-analytics-chart',
  imports: [NgApexchartsModule, TranslatePipe],
  templateUrl: './analytics-chart.component.html',
  styleUrl: './analytics-chart.component.scss'
})
export class AnalyticsChartComponent implements OnInit {
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) courseCount!: number;
  @Input({ required: true }) trainingCount!: number;

  // public props
  chart = viewChild.required<ChartComponent>('chart');
  chartOptions!: Partial<ApexOptions>;

  ngOnInit(): void {
    this.buildChartOptions();

    // Chart labels are baked into chartOptions once here rather than bound via `| translate` in
    // the template — rebuild them whenever the language changes so the legend follows along.
    this.translateService.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.buildChartOptions());
  }

  private buildChartOptions(): void {
    this.chartOptions = {
      chart: {
        type: 'donut',
        height: 300,
        background: 'transparent'
      },
      series: [this.courseCount, this.trainingCount],
      labels: [this.translateService.instant('courses.list.title'), this.translateService.instant('trainings.list.pageTitle')],
      colors: ['#1677ff', '#5cdbd3'],
      dataLabels: {
        enabled: true
      },
      legend: {
        position: 'bottom',
        fontFamily: `'Public Sans', sans-serif`
      },
      tooltip: {
        theme: 'light'
      }
    };
  }
}
