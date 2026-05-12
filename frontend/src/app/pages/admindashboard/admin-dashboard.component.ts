import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent {

  stats = [
    { title: 'Total Users', value: '148' },
    { title: 'Total Interviews', value: '520' },
    { title: 'Average Score', value: '7.4 / 10' },
    { title: 'Active Today', value: '36' }
  ];

  users = [
    {
      name: 'Rorisang Sekomane',
      email: 'rorisang@example.com',
      role: 'Software Developer',
      status: 'Active',
      statusClass: 'green'
    },
    {
      name: 'Thabo Mokoena',
      email: 'thabo@example.com',
      role: 'IT Support',
      status: 'Pending',
      statusClass: 'orange'
    },
    {
      name: 'Lerato Nkosi',
      email: 'lerato@example.com',
      role: 'Data Analyst',
      status: 'Blocked',
      statusClass: 'red'
    }
  ];

  reports = [
    {
      date: '06 May 2026',
      user: 'Rorisang',
      type: 'Technical',
      score: '8/10'
    },
    {
      date: '05 May 2026',
      user: 'Thabo',
      type: 'Behavioral',
      score: '7/10'
    },
    {
      date: '04 May 2026',
      user: 'Lerato',
      type: 'Mixed',
      score: '6/10'
    }
  ];

  summaries = [
    { label: 'Active Users', value: '112', className: 'green' },
    { label: 'Pending Users', value: '24', className: 'orange' },
    { label: 'Blocked Users', value: '12', className: 'red' }
  ];

  performance = [
    { label: 'Technical Interviews', value: 82 },
    { label: 'Behavioral Interviews', value: 68 },
    { label: 'Mixed Interviews', value: 74 }
  ];

}