// angular import
import { Component, DestroyRef, Input, OnInit, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// project import
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

// third party
import { NgApexchartsModule, ChartComponent, ApexOptions } from 'ng-apexcharts';

@Component({
  selector: 'app-sales-report-chart',
  imports: [NgApexchartsModule, TranslatePipe],
  templateUrl: './sales-report-chart.component.html',
  styleUrl: './sales-report-chart.component.scss'
})
export class SalesReportChartComponent implements OnInit {
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) categories!: string[];
  @Input({ required: true }) revenueSeries!: number[];
  @Input({ required: true }) enrollmentSeries!: number[];
  @Input({ required: true }) totalLabel!: string;

  chart = viewChild.required<ChartComponent>('chart');
  chartOptions!: Partial<ApexOptions>;

  ngOnInit(): void {
    this.buildChartOptions();

    // Series names are baked into chartOptions once here rather than bound via `| translate` in
    // the template — rebuild them whenever the language changes so the legend follows along.
    this.translateService.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.buildChartOptions());
  }

  private buildChartOptions(): void {
    this.chartOptions = {
      chart: {
        type: 'bar',
        height: 430,
        toolbar: {
          show: false
        },
        background: 'transparent'
      },
      plotOptions: {
        bar: {
          columnWidth: '30%',
          borderRadius: 4
        }
      },
      stroke: {
        show: true,
        width: 8,
        colors: ['transparent']
      },
      dataLabels: {
        enabled: false
      },
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        show: true,
        fontFamily: `'Public Sans', sans-serif`,
        offsetX: 10,
        offsetY: 10,
        labels: {
          useSeriesColors: false
        },
        itemMargin: {
          horizontal: 15,
          vertical: 5
        }
      },
      series: [
        {
          name: this.translateService.instant('dashboard.admin.revenue'),
          data: this.revenueSeries
        },
        {
          name: this.translateService.instant('dashboard.admin.enrollments'),
          data: this.enrollmentSeries
        }
      ],
      xaxis: {
        categories: this.categories,
        labels: {
          style: {
            colors: this.categories.map(() => '#222')
          }
        }
      },
      tooltip: {
        theme: 'light'
      },
      colors: ['#faad14', '#1677ff'],
      grid: {
        borderColor: '#f5f5f5'
      }
    };
  }
}
