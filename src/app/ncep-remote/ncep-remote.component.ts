import { Component, ElementRef, OnDestroy, signal, ViewChild } from '@angular/core';
import { loadRemoteModule } from '@angular-architects/module-federation';

type RemoteUnmount = () => void | Promise<void>;

type RemoteHostEvent = {
  id: string;
  type: string;
  payload?: Record<string, unknown>;
};

type RemoteOptions = {
  configurationBaseUrl?: string;
  initialFormValues?: Record<string, unknown>;
  onHostEvent?: (event: RemoteHostEvent) => void | Promise<void>;
  profilingEnabled?: boolean;
  strictMode?: boolean;
};

type NcepRemoteModule = {
  mount: (container: HTMLElement, options?: RemoteOptions) => Promise<RemoteUnmount>;
};

const dashboardAuthentications = [
  {
    userType: 'staff',
    userID: 'NB184826',
    authenticationMethod: 'domain',
    authenticationTime: '2025-07-14T07:42:42.97',
    authenticationStatus: 'successful',
  },
  {
    userType: 'party',
    userID: '6000000432',
    authenticationMethod: 'manual staff assisted',
    authenticationTime: '2025-07-14T07:42:42.97',
    authenticationStatus: 'successful',
  },
];

const localJwt = decodeURIComponent(
  'eyJ0eXAiOiJKV1QiLCJraWQiOiI2TUdyamFqMHZ4Q09tSU9uVE1RTHpmUkUwM0oyYnN6NmVIUE1RNDFDMGNJIiwiYWxnIjoiUlMyNTYifQ.eyJpc3MiOiAiaHR0cHM6Ly9pZHAubmVkYmFuay5jby56YSIsICJ0b2tlbl90eXBlIjogIkJlYXJlciIsICJzZXNzaW9uaWQiOiAiYzk4MjQ5NGMtMGRjZi00MTNjLWE1MzktYWEyMzcwNDliOGM5IiwgImF1ZCI6ICJmZGYxZTk3Zi1iNTJkLTQ5NGMtOTQ3NS1mOGY2NTFhMDkxY2QiLCAieC1uZWQtdGVuYW50LWNvZGUiOiAiWkFOQkwiLCAibmlkc3AiOiAiMjciLCAiY2lkIjogIjM5NyIsICJpYXQiOiAxNzYwOTQ0NTE5LCAiZXhwIjogMTc2MDk1MTcxOSwgIm5iZiI6IDE3NjA5NDQ1MTksICJncmFudF90eXBlIjogImFub255bW91cyIsICJhbXIiOiBbXSwgInNjb3BlcyI6IFtdfQ%3D%3D.o36DbF25c_CMhQAyFPE9FW0qot59LH3BI4FXapyidM2AwZtqlb948pXkwXVbcr5I7a4dlFr6kscLZLZLoGxJsAakQZKwotix4MWoXnAsC9AyPxUOxbmImeSQ2LIo_NXVf9UTIejGsG_Jwxd03xZIeVsBtqaZz_nU2Z9Wq-IzX7sWgHv80QWGZviJGSsExTGcQmhN5jxU7zzZzsXOqOKAvyO6kgJc1lO9OKSMR7hC0ryPYWTNdiSDACK8LdHWZPBQ5dQ3X_hWNsOHGW5oPyQagHUSbljhRsdvxmR7_KhyjsGnYMN_xloA6lHan-Lw66fjMBMkSTiOzqu93YFBQSCP1A',
);

@Component({
  selector: 'app-ncep-remote',
  standalone: true,
  template: `
    <main class="remote-shell">
      <div class="remote-toolbar">
        <button type="button" (click)="mountDefault()">Normal startup</button>
        <button type="button" (click)="mountCreateClient()">Create client</button>
        <input
          type="text"
          placeholder="EPN"
          [value]="dashboardEpn()"
          (input)="dashboardEpn.set($any($event.target).value)"
        />
        <button
          type="button"
          [disabled]="!dashboardEpn().trim()"
          (click)="mountDashboard(dashboardEpn())"
        >
          Open dashboard
        </button>
        <button type="button" (click)="unmountMicrosite()">Remove microsite</button>
      </div>
      <div #remoteHost class="remote-host"></div>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }

      .remote-shell {
        min-height: 100vh;
        background: #fff;
      }

      .remote-toolbar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        gap: 8px;
        padding: 8px;
        border-bottom: 1px solid #ddd;
        background: #fff;
      }

      .remote-toolbar button {
        padding: 6px 10px;
        border: 1px solid #999;
        border-radius: 4px;
        background: #f7f7f7;
        cursor: pointer;
      }

      .remote-toolbar input {
        width: 180px;
        padding: 6px 8px;
        border: 1px solid #999;
        border-radius: 4px;
      }

      .remote-toolbar button:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      .remote-host {
        min-height: 100vh;
      }
    `,
  ],
})
export class NcepRemoteComponent implements OnDestroy {
  private readonly remoteEntry = '/remote/assets/remoteEntry.js';
  private readonly configurationBaseUrl = '/remote/configurations';
  private readonly jwt = new URLSearchParams(window.location.search).get('jwt')?.trim() || localJwt;
  protected readonly dashboardEpn = signal('');

  @ViewChild('remoteHost', { static: true })
  private readonly remoteHost!: ElementRef<HTMLElement>;

  private unmount?: RemoteUnmount;
  private lifecycleOperation: Promise<void> = Promise.resolve();
  private destroyed = false;

  private readonly handleHostEvent = (event: RemoteHostEvent): void => {
    console.log('[ncep-angular-shell] Host event received:', event);

    if (event.type !== 'client-created') {
      return;
    }

    const value = event.payload?.['epn'];
    const epn = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

    if (epn && epn !== this.dashboardEpn()) {
      this.dashboardEpn.set(epn);
    }
  };

  async mountDefault(): Promise<void> {
    await this.mountRemote();
  }

  async mountCreateClient(): Promise<void> {
    await this.mountRemote({
      initialFormValues: {
        createClientIntent: {
          requested: true,
          clientType: 'individualOnboarding',
        },
      },
    });
  }

  async mountDashboard(epn: string): Promise<void> {
    const normalizedEpn = epn.trim();

    if (!normalizedEpn) {
      return;
    }

    await this.mountRemote({
      initialFormValues: {
        startupIntent: {
          type: 'open-dashboard',
          epn: normalizedEpn,
        },
        authentications: dashboardAuthentications,
      },
    });
  }

  async unmountMicrosite(): Promise<void> {
    await this.enqueueLifecycleOperation(async () => {
      try {
        await this.performUnmount();
      } finally {
        this.dashboardEpn.set('');
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    void this.enqueueLifecycleOperation(() => this.performUnmount());
  }

  private async mountRemote(options: RemoteOptions = {}): Promise<void> {
    await this.enqueueLifecycleOperation(async () => {
      await this.performUnmount();
      if (this.destroyed) return;

      const remote = (await loadRemoteModule({
        type: 'module',
        remoteEntry: this.remoteEntry,
        exposedModule: './App',
      })) as NcepRemoteModule;
      if (this.destroyed) return;

      const unmount = await remote.mount(this.remoteHost.nativeElement, {
        configurationBaseUrl: this.configurationBaseUrl,
        ...options,
        onHostEvent: this.handleHostEvent,
        initialFormValues: {
          jwt: this.jwt,
          ...options.initialFormValues,
        },
      });

      if (this.destroyed) {
        await unmount();
        this.remoteHost.nativeElement.replaceChildren();
        return;
      }

      this.unmount = unmount;
    });
  }

  private async performUnmount(): Promise<void> {
    const unmount = this.unmount;
    this.unmount = undefined;

    try {
      await unmount?.();
    } finally {
      this.remoteHost.nativeElement.replaceChildren();
    }
  }

  private enqueueLifecycleOperation(operation: () => Promise<void>): Promise<void> {
    const nextOperation = this.lifecycleOperation.then(operation, operation);
    this.lifecycleOperation = nextOperation.catch(() => undefined);
    return nextOperation;
  }
}
