import { DomEvent, DomUtil } from "leaflet";
import { dom, library } from "@fortawesome/fontawesome-svg-core";
import { faCrosshairs } from "@fortawesome/free-solid-svg-icons/faCrosshairs";
import { faLocationArrow } from "@fortawesome/free-solid-svg-icons/faLocationArrow";

library.add(faCrosshairs, faLocationArrow);
dom.watch();

export interface Options {
  center: () => void;
  toggleFollow: () => void;
}

/**
 * Controls for the local player-position layer: buttons to center the map on
 * the player and to toggle following. Designed to sit next to the zoom buttons.
 */
export class PlayerControl {
  private container: HTMLElement;
  private centerBtn: HTMLElement;
  private followBtn: HTMLElement;
  private followEnabled = false;

  public constructor(private options: Options) {
    this.container = DomUtil.create("div", "zd-control__button-group");

    this.centerBtn = DomUtil.create(
      "div",
      "zd-control__button",
      this.container
    );
    const centerIcon = DomUtil.create("i", "fas fa-crosshairs fa-fw", this.centerBtn);
    centerIcon.title = "Center on player";
    this.centerBtn.setAttribute("title", "Center on player");
    DomEvent.disableClickPropagation(this.centerBtn);
    DomEvent.disableScrollPropagation(this.centerBtn);
    DomEvent.addListener(this.centerBtn, "click", DomEvent.stop);
    DomEvent.addListener(this.centerBtn, "click", () => this.options.center());

    this.followBtn = DomUtil.create(
      "div",
      "zd-control__button",
      this.container
    );
    const followIcon = DomUtil.create(
      "i",
      "fas fa-location-arrow fa-fw",
      this.followBtn
    );
    followIcon.title = "Follow player";
    this.followBtn.setAttribute("title", "Follow player");
    DomEvent.disableClickPropagation(this.followBtn);
    DomEvent.disableScrollPropagation(this.followBtn);
    DomEvent.addListener(this.followBtn, "click", DomEvent.stop);
    DomEvent.addListener(this.followBtn, "click", () => {
      this.options.toggleFollow();
    });
  }

  public getButtons(): HTMLElement {
    return this.container;
  }

  public setFollowing(following: boolean): void {
    this.followEnabled = following;
    if (following) {
      DomUtil.addClass(this.followBtn, "selected");
      this.followBtn.setAttribute("title", "Following player (click to stop)");
    } else {
      DomUtil.removeClass(this.followBtn, "selected");
      this.followBtn.setAttribute("title", "Follow player");
    }
  }
}
