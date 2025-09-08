import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserPermissionsDialogComponent } from './user-permissions-dialog.component';

describe('UserPermissionsDialogComponent', () => {
  let component: UserPermissionsDialogComponent;
  let fixture: ComponentFixture<UserPermissionsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserPermissionsDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserPermissionsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
