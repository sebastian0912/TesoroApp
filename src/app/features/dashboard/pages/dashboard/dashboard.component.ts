import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { NavbarComponent } from "../../components/navbar/navbar.component";
import { SidebarComponent } from "../../components/sidebar/sidebar.component";
import { RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ActivityTrackingService } from '../../../../core/services/activity-tracking.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dashboard',
  imports: [
    NavbarComponent,
    SidebarComponent,
    RouterOutlet,
    MatIconModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private tracker = inject(ActivityTrackingService);
  isSidebarHidden = false;

  ngOnInit() {
    this.tracker.startTracking();
  }

  toggleSidebar() {
    this.isSidebarHidden = !this.isSidebarHidden;
  }
}
