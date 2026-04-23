import { Routes } from "@angular/router";
import { LandingPageComponent } from "./pages/landing/landing-page.component";
import { DashboardPageComponent } from "./pages/dashboard/dashboard-page.component";
import { FeedbackReportsPageComponent } from "./pages/feedback-reports/feedback-reports-page.component";
import { InterviewSessionPageComponent } from "./pages/interview-session/interview-session-page.component";
import { ProgressPageComponent } from "./pages/progress/progress-page.component";
import { SettingsPageComponent } from "./pages/settings/settings-page.component";
import { SignInPageComponent } from "./pages/signin/signin-page.component";
import { SignUpPageComponent } from "./pages/signup/signup-page.component";

export const routes: Routes = [
  { path: "", component: LandingPageComponent },
  { path: "dashboard", component: DashboardPageComponent },
  { path: "interview-session", component: InterviewSessionPageComponent },
  { path: "progress", component: ProgressPageComponent },
  { path: "feedback-reports", component: FeedbackReportsPageComponent },
  { path: "settings", component: SettingsPageComponent },
  { path: "signin", component: SignInPageComponent },
  { path: "signup", component: SignUpPageComponent },
  { path: "login", redirectTo: "signin", pathMatch: "full" },
  { path: "register", redirectTo: "signup", pathMatch: "full" },
  { path: "**", redirectTo: "" },
];
