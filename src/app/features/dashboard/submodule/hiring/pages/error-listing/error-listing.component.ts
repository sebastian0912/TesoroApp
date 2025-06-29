import { Component, OnInit } from '@angular/core';
import { ErroresService } from '../../service/errores/errores.service';

@Component({
  selector: 'app-error-listing',
  imports: [],
  templateUrl: './error-listing.component.html',
  styleUrl: './error-listing.component.css'
})
export class ErrorListingComponent implements OnInit {


  constructor() {}

  ngOnInit(): void {
    // Initialization logic can go here
  }

}
