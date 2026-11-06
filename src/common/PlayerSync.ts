import { DivIcon, LatLng, Marker } from "leaflet";
import { ZDMap } from "./ZDMap";
import { PlayerControl } from "./Controls/PlayerControl";

interface PlayerPosResponse {
  ok: boolean;
  error?: string;
  x?: number;
  y?: number;
  z?: number;
  stamina?: number;
  place?: string;
}

/** Zeldadungeon map coordinate for a world (x, z) horizontal point; y is vertical and unused. Same transform as the rest of the map. */
function worldToMap(x: number, z: number): LatLng {
  return new LatLng(-2 * z, 2 * x);
}

/**
 * Shows and live-updates a player position marker by polling the local
 * Savage Wind control endpoint (`/player-pos` in dev). Polling runs only
 * while the tab is visible; the marker is hidden whenever the game is not
 * reachable or no world is loaded.
 */
export class PlayerSync {
  private marker?: Marker;
  private control?: PlayerControl;
  private interval?: ReturnType<typeof setInterval>;
  private placeText?: string;
  private following = false;

  public constructor(private map: ZDMap) {}

  public attach(): void {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        this.startPolling();
      } else {
        this.stopPolling();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", () => void this.sync());
    this.map.on("dragstart", () => {
      if (this.following) {
        this.setFollowing(false);
      }
    });

    this.control = new PlayerControl({
      center: () => void this.centerOnPlayer(),
      toggleFollow: () => this.toggleFollow(),
    });
    this.map.addPlayerControl(this.control);

    this.startPolling();
  }

  private startPolling(): void {
    void this.sync();
    if (this.interval == undefined) {
      this.interval = setInterval(() => void this.sync(), 1000);
    }
  }

  private stopPolling(): void {
    if (this.interval != undefined) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private async sync(): Promise<void> {
    let data: PlayerPosResponse;
    try {
      const response = await fetch("/player-pos", { cache: "no-store" });
      data = await response.json();
    } catch (ex) {
      console.info("Player position unavailable (dev server + game needed).", ex);
      this.hideMarker();
      return;
    }

    if (
      !data.ok ||
      typeof data.x !== "number" ||
      typeof data.z !== "number"
    ) {
      console.info("Player position unavailable:", data.error ?? "unknown error");
      this.hideMarker();
      return;
    }

    const pos = worldToMap(data.x, data.z);
    this.showMarker(pos, data.place);
  }

  private showMarker(pos: LatLng, place?: string): void {
    if (!this.marker) {
      this.marker = new Marker(pos, {
        icon: new DivIcon({
          className: "zd-player",
          html: '<div class="zd-player__halo"></div><div class="zd-player__dot"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        interactive: false,
        keyboard: false,
        title: place ?? "Player",
        zIndexOffset: 1000,
      });
      this.marker.addTo(this.map);
    } else {
      this.marker.setLatLng(pos);
    }

    if (place && place !== this.placeText) {
      this.placeText = place;
      const element = this.marker.getElement?.();
      if (element) {
        element.setAttribute("title", place);
      }
      (this.marker.options as { title?: string }).title = place;
    }

    if (this.following) {
      this.map.panTo(pos, { animate: false });
    }
  }

  private hideMarker(): void {
    if (this.marker) {
      this.marker.remove();
      this.marker = undefined;
      this.placeText = undefined;
    }
  }

  public async centerOnPlayer(): Promise<void> {
    await this.sync();
    if (!this.marker) {
      return;
    }
    const pos = this.marker.getLatLng();
    this.map.setView(pos, Math.max(this.map.getZoom(), 4));
  }

  public toggleFollow(): void {
    this.setFollowing(!this.following);
    if (this.following) {
      void this.sync();
    }
  }

  public isFollowing(): boolean {
    return this.following;
  }

  private setFollowing(following: boolean): void {
    this.following = following;
    this.control?.setFollowing(following);
    if (following && this.marker) {
      this.map.panTo(this.marker.getLatLng(), { animate: true });
    }
  }
}

/** Attach the player-position layer: registers controls, events, and kicks off polling. */
export function attachPlayerSync(map: ZDMap): void {
  const sync = new PlayerSync(map);
  sync.attach();
}
