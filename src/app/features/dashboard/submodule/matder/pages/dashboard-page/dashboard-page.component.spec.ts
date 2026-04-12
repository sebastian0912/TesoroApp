import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatderDashboardPageComponent } from './dashboard-page.component';

describe('MatderDashboardPageComponent', () => {
  let component: MatderDashboardPageComponent;
  let fixture: ComponentFixture<MatderDashboardPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatderDashboardPageComponent, HttpClientTestingModule, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(MatderDashboardPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start in loading state', () => {
    expect(component.loading()).toBe(true);
  });

  it('should have null overview initially', () => {
    expect(component.overview()).toBeNull();
  });

  it('should have empty workspaces initially', () => {
    expect(component.workspaces()).toEqual([]);
  });

  it('nav() should navigate to matder subroute', () => {
    const navigateSpy = spyOn((component as any).router, 'navigate');
    component.nav('workspaces');
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/matder/workspaces']);
  });
});
