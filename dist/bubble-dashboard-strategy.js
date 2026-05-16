// src/index.ts
var STRATEGY_TYPE = "bubble-dashboard";
var DASHBOARD_ELEMENT = "ll-strategy-dashboard-bubble-dashboard";
var VIEW_ELEMENT = "ll-strategy-view-bubble-dashboard";
var DEFAULT_MAX_ENTITIES_PER_AREA = 24;
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
      title: "Bubble Dashboard",
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
      title: config.title || hass.config.location_name || "Bubble Dashboard",
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
            options: config
          }
        },
        ...activeAreas.map((area) => ({
          title: area.name,
          path: slugify(area.name || area.area_id),
          icon: area.icon || "mdi:home-outline",
          strategy: {
            type: `custom:${STRATEGY_TYPE}`,
            view: "area",
            area,
            devices,
            entities,
            options: config
          }
        }))
      ]
    };
  }
};
var BubbleViewStrategy = class extends HTMLElement {
  static async generate(config, hass) {
    const options = config.options || {};
    if (config.view === "home") {
      return buildHomeView(config.areas, config.entities, config.devices, options);
    }
    return buildAreaView(config.area, config.entities, config.devices, hass, options);
  }
};
function buildHomeView(areas, entities, devices, options) {
  const buttons = areas.map((area) => {
    const primaryEntity = findPrimaryEntityForArea(area.area_id, entities, devices);
    return {
      type: "custom:bubble-card",
      card_type: "button",
      button_type: "name",
      name: area.name,
      icon: area.icon || "mdi:home-outline",
      entity: primaryEntity?.entity_id,
      button_action: {
        tap_action: {
          action: "navigate",
          navigation_path: slugify(area.name || area.area_id)
        }
      }
    };
  });
  return {
    type: "sections",
    max_columns: 3,
    sections: [
      {
        type: "grid",
        cards: [
          bubbleSeparator("Rooms", "mdi:floor-plan"),
          {
            type: "grid",
            square: false,
            columns: 2,
            cards: buttons
          },
          ...buildFooter(areas)
        ]
      }
    ]
  };
}
function buildAreaView(area, entities, devices, hass, options) {
  const cards = getAreaEntities(area.area_id, entities, devices, hass, options).slice(0, options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA).map((entity) => entityToBubbleCard(entity));
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
          ...buildFooter([])
        ]
      }
    ]
  };
}
function getAreaEntities(areaId, entities, devices, hass, options) {
  const ignoredEntities = new Set(options.ignored_entities ?? []);
  const ignoredDomains = /* @__PURE__ */ new Set([...options.ignored_domains ?? [], ...DEFAULT_IGNORED_DOMAINS]);
  return entities.filter((entity) => entityBelongsToArea(entity, areaId, devices)).filter((entity) => entity.entity_id in hass.states).filter((entity) => !entity.hidden_by && !entity.disabled_by).filter((entity) => !ignoredEntities.has(entity.entity_id)).filter((entity) => !ignoredDomains.has(getDomain(entity.entity_id))).filter((entity) => DOMAIN_CARD_TYPES[getDomain(entity.entity_id)]).sort((left, right) => getFriendlyName(left, hass).localeCompare(getFriendlyName(right, hass)));
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
function bubbleSeparator(name, icon) {
  return {
    type: "custom:bubble-card",
    card_type: "separator",
    name,
    icon
  };
}
function buildFooter(areas) {
  const footer = {
    type: "custom:bubble-card",
    card_type: "horizontal-buttons-stack",
    "1_link": "/lovelace/home",
    "1_name": "Home",
    "1_icon": "mdi:home",
    auto_order: false
  };
  areas.slice(0, 6).forEach((area, index) => {
    const position = index + 2;
    footer[`${position}_link`] = slugify(area.name || area.area_id);
    footer[`${position}_name`] = area.name;
    footer[`${position}_icon`] = area.icon || "mdi:home-outline";
  });
  return [footer];
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
function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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
    name: "Bubble Dashboard",
    description: "Generates an area-based dashboard with Bubble Card controls.",
    documentationURL: "https://github.com/nikosta87/bubble-dashboard-strategy"
  });
}
console.info(
  "%cBUBBLE-DASHBOARD-STRATEGY%c 0.1.0",
  "color: white; background: #1d8cf8; font-weight: 700; padding: 2px 4px; border-radius: 3px;",
  "color: #1d8cf8; font-weight: 700;"
);
