import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { loadRemoteModule } from '@angular-architects/module-federation';

type RemoteUnmount = () => void;

type RemoteInitialIntent = {
  type: 'create-client';
  clientType?: 'individualOnboarding' | 'juristicOnboarding';
};

type RemoteOptions = {
  configurationBaseUrl?: string;
  initialContext?: Record<string, unknown>;
  initialIntent?: RemoteInitialIntent;
  profilingEnabled?: boolean;
  strictMode?: boolean;
};

type NcepRemoteModule = {
  mount: (container: HTMLElement, options?: RemoteOptions) => Promise<RemoteUnmount>;
};

@Component({
  selector: 'app-ncep-remote',
  standalone: true,
  template: `
    <main class="remote-shell">
      <div class="remote-toolbar">
        <button type="button" (click)="mountDefault()">Normal startup</button>
        <button type="button" (click)="mountCreateClient()">Create client</button>
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

      .remote-host {
        min-height: 100vh;
      }
    `,
  ],
})
export class NcepRemoteComponent implements OnDestroy {
  private readonly remoteEntry = '/remote/assets/remoteEntry.js';
  private readonly configurationBaseUrl = '/remote/configurations';

  @ViewChild('remoteHost', { static: true })
  private readonly remoteHost!: ElementRef<HTMLElement>;

  private unmount?: RemoteUnmount;

  async ngAfterViewInit(): Promise<void> {
    await this.mountDefault();
  }

  async mountDefault(): Promise<void> {
    await this.mountRemote();
  }

  async mountCreateClient(): Promise<void> {
    await this.mountRemote({
      initialIntent: {
        type: 'create-client',
        clientType: 'individualOnboarding',
      },
    });
  }

  ngOnDestroy(): void {
    this.unmount?.();
  }

  private async mountRemote(options: RemoteOptions = {}): Promise<void> {
    this.unmount?.();
    this.remoteHost.nativeElement.replaceChildren();

    const remote = (await loadRemoteModule({
      type: 'module',
      remoteEntry: this.remoteEntry,
      exposedModule: './App',
    })) as NcepRemoteModule;

    this.unmount = await remote.mount(this.remoteHost.nativeElement, {
      configurationBaseUrl: this.configurationBaseUrl,
      ...options,
    });
  }

}
