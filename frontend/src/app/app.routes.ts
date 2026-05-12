import { Routes } from "@angular/router";
import { LandingPageComponent } from "./pages/landing/landing-page.component";
import { FeedbackReportsPageComponent } from "./pages/feedback-reports/feedback-reports-page.component";
import { InterviewSessionPageComponent } from "./pages/interview-session/interview-session-page.component";
import { AuthGuard } from './core/auth/auth.guard';
import { AdminDashboardComponent } from './pages/admindashboard/admin-dashboard.component';

export const routes: Routes = [
  { path: "", component: LandingPageComponent },
  { path: "dashboard", loadComponent: () => import('./pages/dashboard/dashboard-page.component').then(m => m.DashboardPageComponent), canActivate: [AuthGuard] },
  { path: 'admin-dashboard', component: AdminDashboardComponent },

  { path: "interview-session", loadComponent: () => import('./pages/interview-session/interview-session-page.component').then(m => m.InterviewSessionPageComponent), canActivate: [AuthGuard] },
  { path: "progress", loadComponent: () => import('./pages/progress/progress-page.component').then(m => m.ProgressPageComponent), canActivate: [AuthGuard] },
  { path: "feedback-reports", loadComponent: () => import('./pages/feedback-reports/feedback-reports-page.component').then(m => m.FeedbackReportsPageComponent), canActivate: [AuthGuard] },
  { path: "settings", loadComponent: () => import('./pages/settings/settings-page.component').then(m => m.SettingsPageComponent), canActivate: [AuthGuard] },

  { path: "signin", loadComponent: () => import('./pages/signin/signin-page.component').then(m => m.SignInPageComponent) },
  { path: "signup", loadComponent: () => import('./pages/signup/signup-page.component').then(m => m.SignUpPageComponent) },

  { path: "login", redirectTo: "signin", pathMatch: "full" },
  { path: "register", redirectTo: "signup", pathMatch: "full" },

  { path: "**", redirectTo: "" }
];
