// angular import
import { Component, DestroyRef, Input, OnInit, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// project import
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

// third party
import { NgApexchartsModule, ChartComponent, ApexOptions } from 'ng-apexcharts';

@Component({
  selector: 'app-top-performers-chart',
  imports: [NgApexchartsModule, TranslatePipe],
  templateUrl: './top-performers-chart.component.html',
  styleUrl: './top-performers-chart.component.scss'
})
export class TopPerformersChartComponent implements OnInit {
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /** Rank order, best first — index 0 is rendered at the top of the chart (yaxis.reversed below). */
  @Input({ required: true }) labels!: string[];
  @Input({ required: true }) courseRevenue!: (number | null)[];
  @Input({ required: true }) trainingRevenue!: (number | null)[];
  @Input({ required: true }) enrollmentCounts!: number[];

  chart = viewChild.required<ChartComponent>('chart');
  chartOptions!: Partial<ApexOptions>;

  ngOnInit(): void {
    this.buildChartOptions();

    // Series names and the tooltip formatter's text are baked into chartOptions once here rather
    // than bound via `| translate` in the template — rebuild them when the language changes.
    this.translateService.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.buildChartOptions());
  }

  private buildChartOptions(): void {
    const enrollmentCounts = this.enrollmentCounts;
    const translateService = this.translateService;
    const currency = translateService.instant('common.currency');
    // Non-breaking space (U+00A0), not a plain space: with a plain space, "124.65 دينار" renders
    // with the currency word first — something in the SVG text rendering path treats the
    // space-separated amount/currency as swappable "words" and swaps them for Arabic. Confirmed by
    // testing a hyphen-joined string, which was NOT reordered. A non-breaking space looks identical
    // but isn't a plain-space word boundary, so the two chunks stay in the order written here.
    const withCurrency = (amount: number) => `${amount} ${currency}`;

    this.chartOptions = {
      chart: {
        type: 'bar',
        height: Math.max(260, this.labels.length * 60),
        toolbar: {
          show: false
        },
        background: 'transparent'
      },
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 4,
          barHeight: '55%'
        }
      },
      series: [
        {
          name: this.translateService.instant('courses.list.title'),
          data: this.courseRevenue
        },
        {
          name: this.translateService.instant('trainings.list.pageTitle'),
          data: this.trainingRevenue
        }
      ],
      colors: ['#1677ff', '#5cdbd3'],
      dataLabels: {
        enabled: true,
        formatter: (val: number) => (val ? withCurrency(val) : ''),
        style: {
          colors: ['#222']
        }
      },
      xaxis: {
        categories: this.labels,
        labels: {
          style: {
            colors: this.labels.map(() => '#8c8c8c')
          }
        }
      },
      yaxis: {
        reversed: true
      },
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        fontFamily: `'Public Sans', sans-serif`
      },
      tooltip: {
        theme: 'light',
        y: {
          formatter: (val: number, opts?: { dataPointIndex: number }) => {
            const count = opts ? enrollmentCounts[opts.dataPointIndex] : undefined;
            const countLabel =
              count !== undefined
                ? ` · ${translateService.instant(count === 1 ? 'trainings.list.enrollmentSingular' : 'trainings.list.enrollmentPlural', { count, activeSuffix: '' })}`
                : '';
            return `${withCurrency(val)}${countLabel}`;
          }
        }
      },
      grid: {
        borderColor: '#f5f5f5'
      }
    };
  }
}
