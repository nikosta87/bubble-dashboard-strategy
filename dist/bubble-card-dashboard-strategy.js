// src/index.ts
var STRATEGY_TYPE = "bubble-card-dashboard";
var DASHBOARD_ELEMENT = "ll-strategy-dashboard-bubble-card-dashboard";
var VIEW_ELEMENT = "ll-strategy-view-bubble-card-dashboard";
var EDITOR_ELEMENT = "bubble-card-dashboard-strategy-editor";
var TOP_NAV_ELEMENT = "bubble-card-dashboard-top-nav";
var VERSION = "0.9.0";
var DEFAULT_MAX_ENTITIES_PER_AREA = 24;
var DEFAULT_MEDIA_PLAYER_CARD = "bubble-card";
var DEFAULT_SHOW_CAMERA_BUTTON = true;
var ROOMS_POPUP_HASH = "#rooms";
var DOMAIN_CARD_TYPES = {
  alarm_control_panel: "button",
  button: "button",
  climate: "climate",
  cover: "cover",
  fan: "button",
  humidifier: "button",
  input_boolean: "button",
  light: "button",
  lock: "button",
  media_player: "media-player",
  scene: "button",
  script: "button",
  select: "select",
  switch: "button",
  vacuum: "button"
};
var DEFAULT_IGNORED_DOMAINS = /* @__PURE__ */ new Set([
  "automation",
  "camera",
  "device_tracker",
  "event",
  "group",
  "person",
  "sun",
  "update",
  "zone"
]);
var BubbleDashboardStrategy = class extends HTMLElement {
  static getCreateSuggestions(_hass) {
    return {
      title: "Bubble Card Dashboard",
      icon: "mdi:home-variant"
    };
  }
  static async generate(config, hass) {
    const [areas, devices, entities] = await Promise.all([
      hass.callWS({ type: "config/area_registry/list" }),
      hass.callWS({ type: "config/device_registry/list" }),
      hass.callWS({ type: "config/entity_registry/list" })
    ]);
    const activeAreas = areas.filter((area) => entities.some((entity) => entityBelongsToArea(entity, area.area_id, devices))).sort((left, right) => left.name.localeCompare(right.name));
    return {
      title: config.title || hass.config.location_name || "Bubble Card Dashboard",
      views: [
        {
          title: "Dashboard",
          path: "dashboard",
          icon: "mdi:view-dashboard",
          strategy: {
            type: `custom:${STRATEGY_TYPE}`,
            view: "home",
            areas: activeAreas,
            devices,
            entities,
            options: config
          }
        }
      ]
    };
  }
  static async getConfigElement() {
    await customElements.whenDefined(EDITOR_ELEMENT);
    return document.createElement(EDITOR_ELEMENT);
  }
};
var BubbleViewStrategy = class extends HTMLElement {
  static async generate(config, hass) {
    const options = config.options || {};
    if (config.view === "home") {
      return buildHomeView(
        config.areas,
        config.entities,
        config.devices,
        hass,
        options
      );
    }
    return buildAreaView(config.area, config.entities, config.devices, hass, options);
  }
};
var BubbleCardDashboardStrategyEditor = class extends HTMLElement {
  _config = {};
  _hass;
  set hass(hass) {
    this._hass = hass;
    this.render();
  }
  setConfig(config) {
    this._config = {
      media_player_card: DEFAULT_MEDIA_PLAYER_CARD,
      max_entities_per_area: DEFAULT_MAX_ENTITIES_PER_AREA,
      show_camera_button: DEFAULT_SHOW_CAMERA_BUTTON,
      ...config
    };
    this.render();
  }
  connectedCallback() {
    this.render();
  }
  render() {
    const mediaPlayerCard = getMediaPlayerCardType(this._config);
    const maxEntities = this._config.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA;
    const showCameraButton = this._config.show_camera_button ?? DEFAULT_SHOW_CAMERA_BUTTON;
    this.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--primary-text-color);
        }

        .section {
          margin: 0 0 28px;
        }

        .section-title {
          font-weight: 600;
          margin: 0 0 14px;
        }

        .field {
          display: grid;
          grid-template-columns: minmax(150px, 220px) 1fr;
          gap: 16px;
          align-items: center;
          margin: 16px 0 8px;
        }

        label {
          font-weight: 500;
        }

        input,
        select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          font: inherit;
          padding: 10px 12px;
        }

        .hint {
          grid-column: 2;
          color: var(--secondary-text-color);
          font-size: 0.9em;
          line-height: 1.4;
          margin-top: 2px;
        }

        @media (max-width: 640px) {
          .field {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .hint {
            grid-column: 1;
          }
        }
      </style>

      <div class="section">
        <div class="section-title">General</div>
        <div class="field">
          <label for="title">Dashboard title</label>
          <input id="title" data-field="title" type="text" value="${escapeHtml(this._config.title || "")}" placeholder="${escapeHtml(this._hass?.config.location_name || "Bubble Card Dashboard")}">
          <div class="hint">Leave empty to use the Home Assistant location name.</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Navigation</div>
        <div class="field">
          <label for="show_camera_button">Camera button</label>
          <input id="show_camera_button" data-field="show_camera_button" type="checkbox" ${showCameraButton ? "checked" : ""}>
          <div class="hint">Shows or hides the camera icon in the top navigation.</div>
        </div>
        <div class="field">
          <label for="profile_image">Profile image</label>
          <input id="profile_image" data-field="profile_image" type="text" value="${escapeHtml(this._config.profile_image || "")}" placeholder="/local/profile.jpg">
          <div class="hint">Optional image URL for the round avatar. Leave empty to show the current user's initial.</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Media</div>
        <div class="field">
          <label for="media_player_card">Media player card</label>
          <select id="media_player_card" data-field="media_player_card">
            ${mediaPlayerCardOption("bubble-card", "Bubble Card", mediaPlayerCard)}
            ${mediaPlayerCardOption("mini-media-player", "Mini Media Player", mediaPlayerCard)}
            ${mediaPlayerCardOption("yamp", "Yet Another Media Player", mediaPlayerCard)}
          </select>
          <div class="hint">Mini Media Player and YAMP must be installed separately before selecting them.</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Rooms</div>
        <div class="field">
          <label for="max_entities_per_area">Max entities per room</label>
          <input id="max_entities_per_area" data-field="max_entities_per_area" type="number" min="1" max="100" value="${maxEntities}">
          <div class="hint">Limits how many generated entity cards are shown inside each room pop-up.</div>
        </div>
      </div>
    `;
    this.querySelectorAll("[data-field]").forEach((element) => {
      element.addEventListener("change", (event) => this.handleChange(event));
      element.addEventListener("input", (event) => this.handleInput(event));
    });
  }
  handleInput(event) {
    const target = event.target;
    if (target.dataset.field === "title" || target.dataset.field === "profile_image") {
      this.updateConfig(target.dataset.field, target.value || void 0);
    }
  }
  handleChange(event) {
    const target = event.target;
    const field = target.dataset.field;
    if (!field || field === "title") {
      return;
    }
    if (field === "max_entities_per_area") {
      this.updateConfig(field, clampNumber(Number(target.value), 1, 100));
      return;
    }
    if (field === "show_camera_button") {
      this.updateConfig(field, target.checked);
      return;
    }
    this.updateConfig(field, target.value);
  }
  updateConfig(field, value) {
    const nextConfig = {
      ...this._config,
      [field]: value
    };
    if (value === void 0 || value === "") {
      delete nextConfig[field];
    }
    this._config = nextConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: {
          config: nextConfig
        },
        bubbles: true,
        composed: true
      })
    );
  }
};
var BubbleCardDashboardTopNav = class extends HTMLElement {
  _config = {};
  setConfig(config) {
    this._config = config;
    this.render();
  }
  connectedCallback() {
    this.render();
  }
  render() {
    const showCameraButton = this._config.show_camera_button !== false;
    const profileImage = typeof this._config.profile_image === "string" ? this._config.profile_image : "";
    const userInitial = typeof this._config.user_initial === "string" ? this._config.user_initial : "?";
    this.innerHTML = `
      <style>
        ha-card {
          background: transparent;
          box-shadow: none;
          padding: 0;
        }

        .top-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          min-height: 48px;
        }

        .avatar,
        .nav-pill,
        .nav-icon {
          height: 44px;
          border: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          color: var(--primary-text-color);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: none;
          cursor: pointer;
          text-decoration: none;
        }

        .avatar {
          width: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.12);
          font-weight: 700;
        }

        .avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .nav-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-width: 128px;
          padding: 0 18px;
          font: inherit;
          font-weight: 600;
        }

        .nav-icon {
          width: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .nav-pill:hover,
        .nav-icon:hover {
          background: rgba(255, 255, 255, 0.13);
        }

        ha-icon {
          --mdc-icon-size: 20px;
        }

        @media (max-width: 520px) {
          .top-nav {
            gap: 8px;
          }

          .nav-pill {
            min-width: 96px;
            padding: 0 12px;
          }
        }
      </style>
      <ha-card>
        <div class="top-nav">
          <button class="avatar" type="button" aria-label="Profile">
            ${profileImage ? `<img src="${escapeHtml(profileImage)}" alt="Profile">` : escapeHtml(userInitial)}
          </button>
          <button class="nav-pill" type="button" data-path="${ROOMS_POPUP_HASH}">
            <ha-icon icon="mdi:home"></ha-icon>
            <span>Home</span>
          </button>
          ${showCameraButton ? `<button class="nav-pill" type="button" data-path="#cameras">
                  <ha-icon icon="mdi:video"></ha-icon>
                  <span>Cameras</span>
                </button>` : ""}
          <button class="nav-icon" type="button" data-path="/config/dashboard" aria-label="Settings">
            <ha-icon icon="mdi:cog"></ha-icon>
          </button>
        </div>
      </ha-card>
    `;
    this.querySelectorAll("[data-path]").forEach((element) => {
      element.addEventListener("click", () => navigate(element.dataset.path || ""));
    });
  }
};
function buildHomeView(areas, entities, devices, hass, options) {
  return {
    type: "sections",
    max_columns: 2,
    sections: [
      {
        type: "grid",
        cards: [
          buildTopNavigation(hass, options),
          {
            type: "grid",
            square: false,
            columns: 2,
            cards: buildOverviewCards(entities, hass, options)
          },
          buildRoomsPopup(areas, entities, devices),
          ...areas.map((area) => buildRoomPopup(area, entities, devices, hass, options))
        ]
      }
    ]
  };
}
function buildOverviewCards(entities, hass, options) {
  const weather = findFirstStateEntity(hass, ["weather"]);
  const mediaPlayer = findLastUsedMediaPlayer(hass);
  const climate = findFirstStateEntity(hass, ["climate"]);
  const vacuums = findStateEntities(hass, ["vacuum"]).slice(0, 2);
  return [
    ...weather ? [
      fixedHomeCard({
        type: "weather-forecast",
        entity: weather,
        forecast_type: "daily"
      })
    ] : [],
    ...mediaPlayer ? [
      fixedHomeCard(mediaPlayerToCard(mediaPlayer, options))
    ] : [],
    ...climate ? [
      fixedHomeCard({
        type: "custom:bubble-card",
        card_type: "climate",
        entity: climate
      })
    ] : [],
    ...vacuums.map(
      (entity) => fixedHomeCard({
        type: "custom:bubble-card",
        card_type: "button",
        button_type: "state",
        entity,
        sub_button: [
          {
            entity,
            icon: "mdi:play",
            tap_action: {
              action: "call-service",
              service: "vacuum.start",
              target: {
                entity_id: entity
              }
            }
          }
        ]
      })
    )
  ];
}
function buildRoomsPopup(areas, entities, devices) {
  return {
    type: "custom:bubble-card",
    card_type: "pop-up",
    hash: ROOMS_POPUP_HASH,
    name: "Choose a room",
    icon: "mdi:home",
    popup_mode: "centered",
    width_desktop: "680px",
    bg_opacity: "85",
    bg_blur: "12",
    close_by_clicking_outside: true,
    cards: [
      {
        type: "grid",
        square: false,
        columns: 2,
        cards: areas.map((area) => {
          const primaryEntity = findPrimaryEntityForArea(area.area_id, entities, devices);
          return buttonToHash(
            area.name,
            area.icon || "mdi:home-outline",
            getRoomHash(area),
            primaryEntity?.entity_id
          );
        })
      }
    ]
  };
}
function buildRoomPopup(area, entities, devices, hass, options) {
  const areaEntities = getAreaEntities(area.area_id, entities, devices, hass, options).slice(
    0,
    options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA
  );
  const groups = groupRoomEntities(areaEntities);
  const cards = [buttonToHash("Back to rooms", "mdi:arrow-left", ROOMS_POPUP_HASH)];
  groups.forEach((group) => {
    if (!group.entities.length) {
      return;
    }
    cards.push(bubbleSeparator(group.title, group.icon));
    cards.push({
      type: "grid",
      square: false,
      columns: group.columns,
      cards: group.entities.map((entity) => entityToCard(entity, options))
    });
  });
  if (cards.length === 1) {
    cards.push({
      type: "markdown",
      content: "No visible entities found for this area."
    });
  }
  return {
    type: "custom:bubble-card",
    card_type: "pop-up",
    hash: getRoomHash(area),
    name: area.name,
    icon: area.icon || "mdi:home-outline",
    popup_mode: "centered",
    width_desktop: "680px",
    bg_opacity: "85",
    bg_blur: "12",
    show_previous_button: true,
    close_by_clicking_outside: true,
    cards
  };
}
function buildAreaView(area, entities, devices, hass, options) {
  const cards = getAreaEntities(area.area_id, entities, devices, hass, options).slice(0, options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA).map((entity) => entityToCard(entity, options));
  return {
    type: "sections",
    max_columns: 3,
    sections: [
      {
        type: "grid",
        cards: [
          bubbleSeparator(area.name, area.icon || "mdi:home-outline"),
          cards.length ? {
            type: "grid",
            square: false,
            columns: 2,
            cards
          } : {
            type: "markdown",
            content: "No visible entities found for this area."
          },
          buildFooter([])
        ]
      }
    ]
  };
}
function groupRoomEntities(entities) {
  const groupDefinitions = [
    {
      title: "Lights",
      icon: "mdi:lightbulb-group",
      domains: ["light", "switch", "input_boolean"],
      columns: 2
    },
    {
      title: "Climate",
      icon: "mdi:thermostat",
      domains: ["climate", "fan", "humidifier"],
      columns: 2
    },
    {
      title: "Media",
      icon: "mdi:speaker",
      domains: ["media_player"],
      columns: 2
    },
    {
      title: "Covers",
      icon: "mdi:window-shutter",
      domains: ["cover"],
      columns: 1
    },
    {
      title: "Scenes",
      icon: "mdi:palette",
      domains: ["scene", "script", "button"],
      columns: 2
    },
    {
      title: "Devices",
      icon: "mdi:power-plug",
      domains: ["alarm_control_panel", "lock", "select", "vacuum"],
      columns: 2
    }
  ];
  return groupDefinitions.map((definition) => ({
    ...definition,
    entities: entities.filter((entity) => definition.domains.includes(getDomain(entity.entity_id)))
  }));
}
function getAreaEntities(areaId, entities, devices, hass, options) {
  const ignoredEntities = new Set(options.ignored_entities ?? []);
  const ignoredDomains = /* @__PURE__ */ new Set([...options.ignored_domains ?? [], ...DEFAULT_IGNORED_DOMAINS]);
  return entities.filter((entity) => entityBelongsToArea(entity, areaId, devices)).filter((entity) => entity.entity_id in hass.states).filter((entity) => !entity.hidden_by && !entity.disabled_by).filter((entity) => !ignoredEntities.has(entity.entity_id)).filter((entity) => !ignoredDomains.has(getDomain(entity.entity_id))).filter((entity) => DOMAIN_CARD_TYPES[getDomain(entity.entity_id)]).sort((left, right) => getFriendlyName(left, hass).localeCompare(getFriendlyName(right, hass)));
}
function entityToCard(entity, options) {
  const domain = getDomain(entity.entity_id);
  if (domain === "media_player") {
    return mediaPlayerToCard(entity.entity_id, options);
  }
  return entityToBubbleCard(entity);
}
function entityToBubbleCard(entity) {
  const domain = getDomain(entity.entity_id);
  const cardType = DOMAIN_CARD_TYPES[domain] || "button";
  if (cardType === "button") {
    return {
      type: "custom:bubble-card",
      card_type: "button",
      entity: entity.entity_id,
      button_type: ["scene", "script", "button"].includes(domain) ? "name" : "switch"
    };
  }
  return {
    type: "custom:bubble-card",
    card_type: cardType,
    entity: entity.entity_id
  };
}
function mediaPlayerToCard(entityId, options) {
  switch (getMediaPlayerCardType(options)) {
    case "mini-media-player":
      return {
        type: "custom:mini-media-player",
        entity: entityId,
        artwork: "full-cover",
        info: "scroll",
        idle_view: {
          when_idle: true,
          when_paused: true,
          when_standby: true
        }
      };
    case "yamp":
      return {
        type: "custom:yet-another-media-player",
        entities: [entityId],
        idle_screen: "search-recently-played",
        artwork_object_fit: "cover"
      };
    case "bubble-card":
    default:
      return {
        type: "custom:bubble-card",
        card_type: "media-player",
        entity: entityId
      };
  }
}
function getMediaPlayerCardType(options) {
  const configValue = normalizeMediaPlayerCardType(options.media_player_card);
  if (configValue) {
    return configValue;
  }
  return DEFAULT_MEDIA_PLAYER_CARD;
}
function normalizeMediaPlayerCardType(value) {
  const normalizedValue = value?.toLowerCase().trim().replace(/\s+/g, "-").replace(/^yet-another-media-player$/, "yamp");
  if (normalizedValue === "bubble-card" || normalizedValue === "mini-media-player" || normalizedValue === "yamp") {
    return normalizedValue;
  }
  return void 0;
}
function buildTopNavigation(hass, options) {
  return {
    type: `custom:${TOP_NAV_ELEMENT}`,
    show_camera_button: options.show_camera_button ?? DEFAULT_SHOW_CAMERA_BUTTON,
    profile_image: options.profile_image,
    user_initial: getUserInitial(hass)
  };
}
function fixedHomeCard(card) {
  return {
    ...card,
    card_mod: {
      style: `
        ha-card {
          height: 190px;
          min-height: 190px;
          max-height: 190px;
          overflow: hidden;
        }
      `
    }
  };
}
function bubbleSeparator(name, icon) {
  return {
    type: "custom:bubble-card",
    card_type: "separator",
    name,
    icon
  };
}
function buttonToHash(name, icon, hash, entity) {
  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "name",
    name,
    icon,
    entity,
    button_action: {
      tap_action: {
        action: "navigate",
        navigation_path: hash
      }
    }
  };
}
function buildFooter(areas) {
  const footer = {
    type: "custom:bubble-card",
    card_type: "horizontal-buttons-stack",
    "1_link": ROOMS_POPUP_HASH,
    "1_name": "Rooms",
    "1_icon": "mdi:floor-plan",
    auto_order: false,
    highlight_current_view: true
  };
  areas.slice(0, 6).forEach((area, index) => {
    const position = index + 2;
    footer[`${position}_link`] = getRoomHash(area);
    footer[`${position}_name`] = area.name;
    footer[`${position}_icon`] = area.icon || "mdi:home-outline";
  });
  return footer;
}
function findStateEntities(hass, domains) {
  return Object.keys(hass.states).filter((entityId) => domains.includes(getDomain(entityId))).sort();
}
function findFirstStateEntity(hass, domains) {
  return findStateEntities(hass, domains)[0];
}
function findLastUsedMediaPlayer(hass) {
  const mediaPlayers = findStateEntities(hass, ["media_player"]);
  return mediaPlayers.map((entityId) => ({
    entityId,
    score: getMediaPlayerScore(hass, entityId)
  })).sort((left, right) => right.score - left.score || left.entityId.localeCompare(right.entityId))[0]?.entityId;
}
function getMediaPlayerScore(hass, entityId) {
  const state = hass.states[entityId];
  if (!state) {
    return 0;
  }
  const stateRank = {
    playing: 4,
    paused: 3,
    idle: 2,
    standby: 1,
    on: 1
  };
  const mediaMetadataBonus = hasMediaMetadata(state.attributes) ? 1e13 : 0;
  const stateBonus = (stateRank[state.state] || 0) * 1e14;
  const updatedAt = getMediaPlayerUpdatedAt(state);
  return stateBonus + mediaMetadataBonus + updatedAt;
}
function hasMediaMetadata(attributes) {
  return Boolean(
    attributes.media_title || attributes.media_artist || attributes.media_album_name || attributes.entity_picture || attributes.app_name
  );
}
function getMediaPlayerUpdatedAt(state) {
  const candidates = [
    state.attributes.media_position_updated_at,
    state.last_updated,
    state.last_changed
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    const timestamp = Date.parse(candidate);
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }
  return 0;
}
function getRoomHash(area) {
  return `#room-${slugify(area.name || area.area_id)}`;
}
function findPrimaryEntityForArea(areaId, entities, devices) {
  return entities.find((entity) => {
    const domain = getDomain(entity.entity_id);
    return ["light", "switch", "climate", "cover"].includes(domain) && entityBelongsToArea(entity, areaId, devices);
  });
}
function entityBelongsToArea(entity, areaId, devices) {
  if (entity.area_id === areaId) {
    return true;
  }
  if (!entity.area_id && entity.device_id) {
    return devices.some((device) => device.id === entity.device_id && device.area_id === areaId && !device.disabled_by);
  }
  return false;
}
function getDomain(entityId) {
  return entityId.split(".", 1)[0] || "";
}
function getFriendlyName(entity, hass) {
  const state = hass.states[entity.entity_id];
  const friendlyName = state?.attributes.friendly_name;
  return String(friendlyName || entity.name || entity.original_name || entity.entity_id);
}
function getUserInitial(hass) {
  return (hass.user?.name || "?").trim().slice(0, 1).toUpperCase() || "?";
}
function mediaPlayerCardOption(value, label, selectedValue) {
  return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
}
function clampNumber(value, min, max) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function navigate(path) {
  if (!path) {
    return;
  }
  if (path.startsWith("#")) {
    window.location.hash = path;
    return;
  }
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event("location-changed"));
}
function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
if (!customElements.get(DASHBOARD_ELEMENT)) {
  customElements.define(DASHBOARD_ELEMENT, BubbleDashboardStrategy);
}
if (!customElements.get(VIEW_ELEMENT)) {
  customElements.define(VIEW_ELEMENT, BubbleViewStrategy);
}
if (!customElements.get(EDITOR_ELEMENT)) {
  customElements.define(EDITOR_ELEMENT, BubbleCardDashboardStrategyEditor);
}
if (!customElements.get(TOP_NAV_ELEMENT)) {
  customElements.define(TOP_NAV_ELEMENT, BubbleCardDashboardTopNav);
}
window.customStrategies = window.customStrategies || [];
if (!window.customStrategies.some((strategy) => strategy.type === STRATEGY_TYPE && strategy.strategyType === "dashboard")) {
  window.customStrategies.push({
    type: STRATEGY_TYPE,
    strategyType: "dashboard",
    name: "Bubble Card Dashboard",
    description: "Generates an area-based dashboard with Bubble Card controls.",
    documentationURL: "https://github.com/nikosta87/bubble-card-dashboard-strategy"
  });
}
console.info(
  `%cBUBBLE-CARD-DASHBOARD-STRATEGY%c ${VERSION}`,
  "color: white; background: #1d8cf8; font-weight: 700; padding: 2px 4px; border-radius: 3px;",
  "color: #1d8cf8; font-weight: 700;"
);
