import { TestBed } from '@angular/core/testing';
import { loadRemoteModule } from '@angular-architects/module-federation';

import { NcepRemoteComponent } from './ncep-remote.component';

vi.mock('@angular-architects/module-federation', () => ({
  loadRemoteModule: vi.fn(),
}));

describe('NcepRemoteComponent', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('receives a newly created client EPN from the remote', async () => {
    const unmount = vi.fn();
    const mount = vi.fn().mockResolvedValue(unmount);
    vi.mocked(loadRemoteModule).mockResolvedValue({ mount } as never);

    await TestBed.configureTestingModule({
      imports: [NcepRemoteComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(NcepRemoteComponent);
    fixture.detectChanges();

    await fixture.componentInstance.mountCreateClient();

    const remoteOptions = mount.mock.calls[0][1];
    remoteOptions.onHostEvent({
      id: 'client-created:6000000999',
      type: 'client-created',
      payload: { epn: ' 6000000999 ' },
    });

    expect(Reflect.get(fixture.componentInstance, 'dashboardEpn')()).toBe('6000000999');
  });

  it('unmounts the microsite and restores the initial shell state', async () => {
    await TestBed.configureTestingModule({
      imports: [NcepRemoteComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(NcepRemoteComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;
    const remoteHost = compiled.querySelector('.remote-host') as HTMLElement;
    const epnInput = compiled.querySelector('input') as HTMLInputElement;
    const removeButton = Array.from(compiled.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Remove microsite',
    ) as HTMLButtonElement;
    const unmount = vi.fn();

    remoteHost.append(document.createElement('div'));
    epnInput.value = '123456';
    epnInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    Reflect.set(component, 'unmount', unmount);

    removeButton.click();
    await fixture.whenStable();

    expect(unmount).toHaveBeenCalledOnce();
    expect(remoteHost.childElementCount).toBe(0);
    expect(epnInput.value).toBe('');
    expect(Reflect.get(component, 'unmount')).toBeUndefined();
  });

  it('waits for asynchronous remote teardown before clearing the host', async () => {
    await TestBed.configureTestingModule({
      imports: [NcepRemoteComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(NcepRemoteComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const remoteHost = fixture.nativeElement.querySelector('.remote-host') as HTMLElement;
    let finishUnmount!: () => void;
    const unmount = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishUnmount = resolve;
        }),
    );

    remoteHost.append(document.createElement('div'));
    Reflect.set(component, 'unmount', unmount);

    const teardown = component.unmountMicrosite();
    await Promise.resolve();

    expect(unmount).toHaveBeenCalledOnce();
    expect(remoteHost.childElementCount).toBe(1);

    finishUnmount();
    await teardown;

    expect(remoteHost.childElementCount).toBe(0);
  });
});
