import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent } from '../../shared/layout/layout.component';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, LayoutComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css'
})
export class ReportsComponent {
  // Solo vista
}

