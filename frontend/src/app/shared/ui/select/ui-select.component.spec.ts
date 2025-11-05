import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { UiSelectComponent } from './ui-select';

describe('UiSelectComponent', () => {
  let fixture: ComponentFixture<UiSelectComponent>;
  let component: UiSelectComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiSelectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UiSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('closes the single-select panel and restores focus when an option is clicked', fakeAsync(() => {
    component.options = [
      { value: 'one', label: 'One', disabled: false },
      { value: 'two', label: 'Two', disabled: false },
    ];
    fixture.detectChanges();

    component.togglePanel();
    fixture.detectChanges();

    expect(component.panelOpen).withContext('panel should open before selection').toBeTrue();

    const trigger = component['triggerRef']?.nativeElement as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    const focusSpy = spyOn(trigger, 'focus').and.callThrough();

    component.onOptionClick({ value: 'two', label: 'Two', disabled: false });
    flushMicrotasks();
    fixture.detectChanges();

    expect(component.panelOpen).withContext('panel should close after selecting').toBeFalse();
    expect(component.value).toBe('two');
    expect(component['selectedLabel']).toBe('Two');
    expect(focusSpy).toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  }));
});
