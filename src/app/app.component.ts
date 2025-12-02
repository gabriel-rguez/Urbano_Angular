import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'gestion_ecomovil';

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    // El servicio se inicializa automáticamente y aplica el tema
    this.themeService.getCurrentTheme();
  }
}
