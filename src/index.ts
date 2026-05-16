export {};

type HassEntity = {
  entity_id: string;
  device_id?: string | null;
  area_id?: string | null;
  hidden_by?: string | null;
  disabled_by?: string | null;
  name?: string | null;
  original_name?: string | null;
};

type HassDevice = {
  id: string;
  area_id?: string | null;
  disabled_by?: string | null;
};

type HassArea = {
  area_id: string;
  name: string;
  icon?: string | null;
};

type HomeAssistant = {
  config: {
    location_name?: string;
  };
  states: Record<string, { entity_id: string; state: string; attributes: Record<string, unknown> }>;
  callWS<T>(message: Record<string, unknown>): Promise<T>;
};

type StrategyConfig = {
  title?: string;
  ignored_entities?: string[];
  ignored_domains?: string[];
  max_entities_per_area?: number;
};

type LovelaceCard = Record<string, unknown>;

const STRATEGY_TYPE = "bubble-card-dashboard";
const DASHBOARD_ELEMENT = "ll-strategy-dashboard-bubble-card-dashboard";
const VIEW_ELEMENT = "ll-strategy-view-bubble-card-dashboard";
const DEFAULT_MAX_ENTITIES_PER_AREA = 24;
const ROOMS_POPUP_HASH = "#rooms";

const DOMAIN_CARD_TYPES: Record<string, string> = {
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
  vacuum: "button",
};

const DEFAULT_IGNORED_DOMAINS = new Set([
  "automation",
  "camera",
  "device_tracker",
  "event",
  "group",
  "person",
  "sun",
  "update",
  "zone",
]);

class BubbleDashboardStrategy extends HTMLElement {
  static getCreateSuggestions(_hass: HomeAssistant) {
    return {
      title: "Bubble Card Dashboard",
      icon: "mdi:home-variant",
    };
  }

  static async generate(config: StrategyConfig, hass: HomeAssistant) {
    const [areas, devices, entities] = await Promise.all([
      hass.callWS<HassArea[]>({ type: "config/area_registry/list" }),
      hass.callWS<HassDevice[]>({ type: "config/device_registry/list" }),
      hass.callWS<HassEntity[]>({ type: "config/entity_registry/list" }),
    ]);

    const activeAreas = areas
      .filter((area) => entities.some((entity) => entityBelongsToArea(entity, area.area_id, devices)))
      .sort((left, right) => left.name.localeCompare(right.name));

    return {
      title: config.title || hass.config.location_name || "Bubble Card Dashboard",
      views: [
        {
          title: "Home",
          path: "home",
          icon: "mdi:home",
          strategy: {
            type: `custom:${STRATEGY_TYPE}`,
            view: "home",
            areas: activeAreas,
            devices,
            entities,
            options: config,
          },
        },
      ],
    };
  }
}

class BubbleViewStrategy extends HTMLElement {
  static async generate(config: Record<string, unknown>, hass: HomeAssistant) {
    const options = (config.options || {}) as StrategyConfig;

    if (config.view === "home") {
      return buildHomeView(
        config.areas as HassArea[],
        config.entities as HassEntity[],
        config.devices as HassDevice[],
        hass,
        options,
      );
    }

    return buildAreaView(config.area as HassArea, config.entities as HassEntity[], config.devices as HassDevice[], hass, options);
  }
}

function buildHomeView(
  areas: HassArea[],
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
) {
  return {
    type: "masonry",
    cards: [
      {
        type: "grid",
        square: false,
        columns: 2,
        cards: buildOverviewCards(entities, hass),
      },
      buildRoomsPopup(areas, entities, devices),
      ...areas.map((area) => buildRoomPopup(area, entities, devices, hass, options)),
      buildFooter(areas),
    ],
  };
}

function buildOverviewCards(entities: HassEntity[], hass: HomeAssistant): LovelaceCard[] {
  const weather = findFirstStateEntity(hass, ["weather"]);
  const mediaPlayer = findFirstStateEntity(hass, ["media_player"]);
  const climate = findFirstStateEntity(hass, ["climate"]);
  const vacuums = findStateEntities(hass, ["vacuum"]).slice(0, 2);

  return [
    buttonToHash("Rooms", "mdi:floor-plan", ROOMS_POPUP_HASH),
    ...(weather
      ? [
          {
            type: "weather-forecast",
            entity: weather,
            forecast_type: "daily",
          },
        ]
      : []),
    ...(mediaPlayer
      ? [
          {
            type: "custom:bubble-card",
            card_type: "media-player",
            entity: mediaPlayer,
          },
        ]
      : []),
    ...(climate
      ? [
          {
            type: "custom:bubble-card",
            card_type: "climate",
            entity: climate,
          },
        ]
      : []),
    ...vacuums.map((entity) => ({
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
              entity_id: entity,
            },
          },
        },
      ],
    })),
  ];
}

function buildRoomsPopup(areas: HassArea[], entities: HassEntity[], devices: HassDevice[]): LovelaceCard {
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
            primaryEntity?.entity_id,
          );
        }),
      },
    ],
  };
}

function buildRoomPopup(
  area: HassArea,
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
): LovelaceCard {
  const areaEntities = getAreaEntities(area.area_id, entities, devices, hass, options).slice(
    0,
    options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA,
  );
  const groups = groupRoomEntities(areaEntities);
  const cards: LovelaceCard[] = [buttonToHash("Back to rooms", "mdi:arrow-left", ROOMS_POPUP_HASH)];

  groups.forEach((group) => {
    if (!group.entities.length) {
      return;
    }

    cards.push(bubbleSeparator(group.title, group.icon));
    cards.push({
      type: "grid",
      square: false,
      columns: group.columns,
      cards: group.entities.map((entity) => entityToBubbleCard(entity)),
    });
  });

  if (cards.length === 1) {
    cards.push({
      type: "markdown",
      content: "No visible entities found for this area.",
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
    cards,
  };
}

function buildAreaView(
  area: HassArea,
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
) {
  const cards = getAreaEntities(area.area_id, entities, devices, hass, options)
    .slice(0, options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA)
    .map((entity) => entityToBubbleCard(entity));

  return {
    type: "sections",
    max_columns: 3,
    sections: [
      {
        type: "grid",
        cards: [
          bubbleSeparator(area.name, area.icon || "mdi:home-outline"),
          cards.length
            ? {
                type: "grid",
                square: false,
                columns: 2,
                cards,
              }
            : {
                type: "markdown",
                content: "No visible entities found for this area.",
              },
          buildFooter([]),
        ],
      },
    ],
  };
}

function groupRoomEntities(entities: HassEntity[]) {
  const groupDefinitions = [
    {
      title: "Lights",
      icon: "mdi:lightbulb-group",
      domains: ["light", "switch", "input_boolean"],
      columns: 2,
    },
    {
      title: "Climate",
      icon: "mdi:thermostat",
      domains: ["climate", "fan", "humidifier"],
      columns: 2,
    },
    {
      title: "Media",
      icon: "mdi:speaker",
      domains: ["media_player"],
      columns: 2,
    },
    {
      title: "Covers",
      icon: "mdi:window-shutter",
      domains: ["cover"],
      columns: 1,
    },
    {
      title: "Scenes",
      icon: "mdi:palette",
      domains: ["scene", "script", "button"],
      columns: 2,
    },
    {
      title: "Devices",
      icon: "mdi:power-plug",
      domains: ["alarm_control_panel", "lock", "select", "vacuum"],
      columns: 2,
    },
  ];

  return groupDefinitions.map((definition) => ({
    ...definition,
    entities: entities.filter((entity) => definition.domains.includes(getDomain(entity.entity_id))),
  }));
}

function getAreaEntities(
  areaId: string,
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
) {
  const ignoredEntities = new Set(options.ignored_entities ?? []);
  const ignoredDomains = new Set([...(options.ignored_domains ?? []), ...DEFAULT_IGNORED_DOMAINS]);

  return entities
    .filter((entity) => entityBelongsToArea(entity, areaId, devices))
    .filter((entity) => entity.entity_id in hass.states)
    .filter((entity) => !entity.hidden_by && !entity.disabled_by)
    .filter((entity) => !ignoredEntities.has(entity.entity_id))
    .filter((entity) => !ignoredDomains.has(getDomain(entity.entity_id)))
    .filter((entity) => DOMAIN_CARD_TYPES[getDomain(entity.entity_id)])
    .sort((left, right) => getFriendlyName(left, hass).localeCompare(getFriendlyName(right, hass)));
}

function entityToBubbleCard(entity: HassEntity): LovelaceCard {
  const domain = getDomain(entity.entity_id);
  const cardType = DOMAIN_CARD_TYPES[domain] || "button";

  if (cardType === "button") {
    return {
      type: "custom:bubble-card",
      card_type: "button",
      entity: entity.entity_id,
      button_type: ["scene", "script", "button"].includes(domain) ? "name" : "switch",
    };
  }

  return {
    type: "custom:bubble-card",
    card_type: cardType,
    entity: entity.entity_id,
  };
}

function bubbleSeparator(name: string, icon: string): LovelaceCard {
  return {
    type: "custom:bubble-card",
    card_type: "separator",
    name,
    icon,
  };
}

function buttonToHash(name: string, icon: string, hash: string, entity?: string): LovelaceCard {
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
        navigation_path: hash,
      },
    },
  };
}

function buildFooter(areas: HassArea[]): LovelaceCard {
  const footer: LovelaceCard = {
    type: "custom:bubble-card",
    card_type: "horizontal-buttons-stack",
    "1_link": ROOMS_POPUP_HASH,
    "1_name": "Rooms",
    "1_icon": "mdi:home",
    auto_order: false,
    highlight_current_view: true,
  };

  areas.slice(0, 6).forEach((area, index) => {
    const position = index + 2;
    footer[`${position}_link`] = getRoomHash(area);
    footer[`${position}_name`] = area.name;
    footer[`${position}_icon`] = area.icon || "mdi:home-outline";
  });

  return footer;
}

function findStateEntities(hass: HomeAssistant, domains: string[]) {
  return Object.keys(hass.states)
    .filter((entityId) => domains.includes(getDomain(entityId)))
    .sort();
}

function findFirstStateEntity(hass: HomeAssistant, domains: string[]) {
  return findStateEntities(hass, domains)[0];
}

function getRoomHash(area: HassArea) {
  return `#room-${slugify(area.name || area.area_id)}`;
}

function findPrimaryEntityForArea(areaId: string, entities: HassEntity[], devices: HassDevice[]) {
  return entities.find((entity) => {
    const domain = getDomain(entity.entity_id);
    return ["light", "switch", "climate", "cover"].includes(domain) && entityBelongsToArea(entity, areaId, devices);
  });
}

function entityBelongsToArea(entity: HassEntity, areaId: string, devices: HassDevice[]) {
  if (entity.area_id === areaId) {
    return true;
  }

  if (!entity.area_id && entity.device_id) {
    return devices.some((device) => device.id === entity.device_id && device.area_id === areaId && !device.disabled_by);
  }

  return false;
}

function getDomain(entityId: string) {
  return entityId.split(".", 1)[0] || "";
}

function getFriendlyName(entity: HassEntity, hass: HomeAssistant) {
  const state = hass.states[entity.entity_id];
  const friendlyName = state?.attributes.friendly_name;

  return String(friendlyName || entity.name || entity.original_name || entity.entity_id);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

if (!customElements.get(DASHBOARD_ELEMENT)) {
  customElements.define(DASHBOARD_ELEMENT, BubbleDashboardStrategy);
}

if (!customElements.get(VIEW_ELEMENT)) {
  customElements.define(VIEW_ELEMENT, BubbleViewStrategy);
}

window.customStrategies = window.customStrategies || [];

if (!window.customStrategies.some((strategy) => strategy.type === STRATEGY_TYPE && strategy.strategyType === "dashboard")) {
  window.customStrategies.push({
    type: STRATEGY_TYPE,
    strategyType: "dashboard",
    name: "Bubble Card Dashboard",
    description: "Generates an area-based dashboard with Bubble Card controls.",
    documentationURL: "https://github.com/nikosta87/bubble-card-dashboard-strategy",
  });
}

console.info(
  "%cBUBBLE-CARD-DASHBOARD-STRATEGY%c 0.2.0",
  "color: white; background: #1d8cf8; font-weight: 700; padding: 2px 4px; border-radius: 3px;",
  "color: #1d8cf8; font-weight: 700;",
);

declare global {
  interface Window {
    customStrategies?: Array<Record<string, unknown>>;
  }
}
