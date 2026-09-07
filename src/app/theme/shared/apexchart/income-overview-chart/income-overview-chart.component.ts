// angular import
import { Component, Input, OnInit, viewChild } from '@angular/core';

// project import
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { TranslatePipe } from '@ngx-translate/core';

// third party
import { NgApexchartsModule, ChartComponent, ApexOptions } from 'ng-apexcharts';

@Component({
  selector: 'app-income-overview-chart',
  imports: [CardComponent, NgApexchartsModule, TranslatePipe],
  templateUrl: './income-overview-chart.component.html',
  styleUrl: './income-overview-chart.component.scss'
})
export class IncomeOverviewChartComponent implements OnInit {
  @Input({ required: true }) categories!: string[];
  @Input({ required: true }) revenueSeries!: number[];
  @Input({ required: true }) totalLabel!: string;

  // public props
  chart = viewChild.required<ChartComponent>('chart');
  chartOptions!: Partial<ApexOptions>;

  ngOnInit(): void {
    this.chartOptions = {
      chart: {
        type: 'bar',
        height: 365,
        toolbar: {
          show: false
        },
        background: 'transparent'
      },
      plotOptions: {
        bar: {
          columnWidth: '45%',
          borderRadius: 4
        }
      },
      dataLabels: {
        enabled: false
      },
      series: [
        {
          data: this.revenueSeries
        }
      ],
      stroke: {
        curve: 'smooth',
        width: 2
      },
      xaxis: {
        categories: this.categories,
        axisBorder: {
          show: false
        },
        axisTicks: {
          show: false
        },
        labels: {
          style: {
            colors: this.categories.map(() => '#8c8c8c')
          }
        }
      },
      yaxis: {
        show: false
      },
      colors: ['#5cdbd3'],
      grid: {
        show: false
      },
      tooltip: {
        theme: 'light'
      }
    };
  }
}
