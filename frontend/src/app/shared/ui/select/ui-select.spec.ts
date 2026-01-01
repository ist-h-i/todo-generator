import { TestBed } from '@angular/core/testing';

import { UiSelect } from './ui-select';

describe('UiSelect', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiSelect],
    }).compileComponents();
  });

  it('renders the placeholder when no value is selected', () => {
    const fixture = TestBed.createComponent(UiSelect);
    fixture.componentRef.setInput('placeholder', 'Choose one');
    fixture.componentRef.setInput('options', [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ]);

    fixture.detectChanges();

    const valueEl = fixture.nativeElement.querySelector('.ui-select__value') as HTMLElement | null;
    expect(valueEl?.textContent?.trim()).toBe('Choose one');
  });

  it('shows the selected option label when writeValue matches an option', () => {
    const fixture = TestBed.createComponent(UiSelect);
    fixture.componentRef.setInput('options', [
      { value: 1, label: 'One' },
      { value: 2, label: 'Two' },
    ]);

    fixture.detectChanges();

    fixture.componentInstance.writeValue('2');
    fixture.detectChanges();

    const valueEl = fixture.nativeElement.querySelector('.ui-select__value') as HTMLElement | null;
    expect(valueEl?.textContent?.trim()).toBe('Two');
  });

  it('syncs the label when a value input is provided', () => {
    const fixture = TestBed.createComponent(UiSelect);
    fixture.componentRef.setInput('options', [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ]);
    fixture.componentRef.setInput('value', 'b');

    fixture.detectChanges();

    const valueEl = fixture.nativeElement.querySelector('.ui-select__value') as HTMLElement | null;
    expect(valueEl?.textContent?.trim()).toBe('Beta');
  });

  it('opens the panel and emits the selected value when an option is clicked', () => {
    const fixture = TestBed.createComponent(UiSelect);
    fixture.componentRef.setInput('options', [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ]);

    const onChange = jasmine.createSpy('onChange');
    fixture.componentInstance.registerOnChange(onChange);
    const valueChange = jasmine.createSpy('valueChange');
    const subscription = fixture.componentInstance.valueChange.subscribe(valueChange);

    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      'button.ui-select__trigger',
    ) as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();

    trigger?.click();
    fixture.detectChanges();

    const optionEls = Array.from(
      fixture.nativeElement.querySelectorAll('.ui-select__option'),
    ) as HTMLElement[];
    expect(optionEls.length).toBe(2);

    optionEls[1].click();
    fixture.detectChanges();

    expect(onChange).toHaveBeenCalledWith('b');
    expect(valueChange).toHaveBeenCalledWith('b');
    expect(fixture.componentInstance.panelOpen()).toBeFalse();

    const valueEl = fixture.nativeElement.querySelector('.ui-select__value') as HTMLElement | null;
    expect(valueEl?.textContent?.trim()).toBe('Beta');

    subscription.unsubscribe();
  });

  it('ignores clicks on disabled options', () => {
    const fixture = TestBed.createComponent(UiSelect);
    fixture.componentRef.setInput('options', [
      { value: 'a', label: 'Alpha', disabled: true },
      { value: 'b', label: 'Beta' },
    ]);

    const onChange = jasmine.createSpy('onChange');
    fixture.componentInstance.registerOnChange(onChange);

    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      'button.ui-select__trigger',
    ) as HTMLButtonElement | null;
    trigger?.click();
    fixture.detectChanges();

    const optionEls = Array.from(
      fixture.nativeElement.querySelectorAll('.ui-select__option'),
    ) as HTMLElement[];
    expect(optionEls.length).toBe(2);

    optionEls[0].click();
    fixture.detectChanges();

    expect(onChange).not.toHaveBeenCalled();
    expect(fixture.componentInstance.panelOpen()).toBeTrue();
  });

  it('emits an array of selected values in multiple mode', () => {
    const fixture = TestBed.createComponent(UiSelect);
    fixture.componentRef.setInput('multiple', true);
    fixture.componentRef.setInput('options', [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ]);

    const onChange = jasmine.createSpy('onChange');
    fixture.componentInstance.registerOnChange(onChange);

    fixture.detectChanges();

    const selectEl = fixture.nativeElement.querySelector(
      'select.form-control.app-select',
    ) as HTMLSelectElement | null;
    expect(selectEl).not.toBeNull();

    if (!selectEl) {
      return;
    }

    selectEl.options[0].selected = true;
    selectEl.options[1].selected = true;
    selectEl.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });
});
