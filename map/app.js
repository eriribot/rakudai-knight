/**
 * 落第骑士英雄谭 - WORLD ATLAS 主应用逻辑
 * 采用 OSM HOT 二次元粉彩东京底图 + 原生汉字注记 + 树状地图册抽屉 + MVU/插件桥接
 */

(function () {
  let mapInstance = null;
  let markersMap = new Map();
  let connectingLinesGroup = null;
  let activePlaceId = null;

  // 初始化入口
  document.addEventListener("DOMContentLoaded", () => {
    initMap();
    renderMarkers();
    drawHagunConnections();
    updateMarkersLOD();
    renderSidebar();
    renderStatus();
    initSearch();
    initControls();
    initPetals();
    exposePluginBridge();

    // 支持 URL 查询参数深度直达（如 ?select=shinjuku_underground_colosseum）
    const urlParams = new URLSearchParams(window.location.search);
    const selectParam = urlParams.get("select");
    if (selectParam) {
      setTimeout(() => selectPlace(selectParam), 400);
    }
  });

  /**
   * 初始化 Leaflet 地图
   * 采用 OpenStreetMap Humanitarian (HOT) 实景粉彩瓦片底图，支持自由缩放平移
   */
  function initMap() {
    const tokyoView = RAKUDAI_WORLD_DATA.views.tokyo || { center: [35.6600, 139.4200], zoom: 11 };

    mapInstance = L.map("map-viewport", {
      center: tokyoView.center,
      zoom: tokyoView.zoom,
      minZoom: 9,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false
    });

    // 加载与二次元巡礼图同款的 OSM HOT 粉彩实景底图（自带原生中文/日文汉字标注、粉粉柔和色调、无水印、可自由无限缩放）
    L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      subdomains: ["a", "b", "c"],
      maxZoom: 19,
      crossOrigin: true
    }).addTo(mapInstance);

    connectingLinesGroup = L.layerGroup().addTo(mapInstance);

    // 地图点击时收起详情卡片
    mapInstance.on("click", () => {
      closeDetailModal();
    });

    // 缩放等级改变时更新地标细节层次 (LOD)
    mapInstance.on("zoomend", updateMarkersLOD);
  }

  /**
   * 根据缩放等级动态控制细节层次 (LOD)
   * 广域全东京视角 (zoom < 13)：突出破军本部与各区大坐标，保持视野开阔清晰
   * 校园放大视角 (zoom >= 13)：自动展开破军校内各训练场、宿舍与辐射虚线
   */
  function updateMarkersLOD() {
    if (!mapInstance) return;
    const currentZoom = mapInstance.getZoom();
    const searchInput = document.getElementById("search-input");
    const isSearching = searchInput && searchInput.value.trim().length > 0;

    markersMap.forEach((marker, placeId) => {
      const place = RAKUDAI_WORLD_DATA.places.find((p) => p.id === placeId);
      if (!place) return;

      // 破军校内细分微观设施：仅在校园级视角 (zoom >= 13) 展开
      if (place.clusterId === "hagun_cluster" && !place.isMainAnchor) {
        if (currentZoom < 13 && !isSearching) {
          if (mapInstance.hasLayer(marker)) mapInstance.removeLayer(marker);
        } else {
          if (!mapInstance.hasLayer(marker)) mapInstance.addLayer(marker);
        }
      }

      // 奥多摩深山点位：广域全景 (zoom < 12) 时隐藏，避免与左上角纯透明 Logo 产生视觉重叠；zoom >= 12 或点击集群时展开
      if (place.clusterId === "okutama_cluster") {
        if (currentZoom < 12 && !isSearching) {
          if (mapInstance.hasLayer(marker)) mapInstance.removeLayer(marker);
        } else {
          if (!mapInstance.hasLayer(marker)) mapInstance.addLayer(marker);
        }
      }
    });

    if (currentZoom < 13 && !isSearching) {
      if (mapInstance.hasLayer(connectingLinesGroup)) mapInstance.removeLayer(connectingLinesGroup);
    } else {
      if (!mapInstance.hasLayer(connectingLinesGroup)) mapInstance.addLayer(connectingLinesGroup);
    }
  }

  /**
   * 渲染地图图钉徽章
   */
  function renderMarkers() {
    markersMap.forEach((marker) => mapInstance.removeLayer(marker));
    markersMap.clear();

    const places = RAKUDAI_WORLD_DATA.places;

    places.forEach((place) => {
      let marker;

      if (place.isMainAnchor) {
        // 破军学园核心大图钉（带动态呼吸光环、学园校徽与悬浮概览卡）
        const hagunIcon = L.divIcon({
          className: "custom-marker-wrapper",
          html: `
            <div class="custom-marker-hagun" id="marker-${place.id}">
              <div class="hagun-pulse-ring"></div>
              <div class="hagun-core-circle">🏛️</div>
              <div class="hagun-title-label">${place.name}</div>
              <div class="hagun-preview-card" onclick="window.RakudaiAtlas.selectPlace('${place.id}')">
                <img src="${place.thumb}" class="hagun-card-img" alt="${place.name}" onerror="this.src='assets/hagun_campus_hero.jpg'" />
                <div class="hagun-card-body">
                  <div class="hagun-card-title-row">
                    <span class="hagun-card-title">${place.name}</span>
                    <span style="color: var(--crimson-primary); font-size: 11px;">▶</span>
                  </div>
                  <div class="hagun-card-slogan">${place.slogan || "剣が紡ぐ、俺たちの青春——"}</div>
                </div>
              </div>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        });

        marker = L.marker([place.lat, place.lng], { icon: hagunIcon, zIndexOffset: 1000 });
      } else {
        // 二游风格分类地标图钉
        let typeIcon = "🏛️";
        if (place.type === "battle") typeIcon = "⚔️";
        if (place.type === "story") typeIcon = "⭐";
        if (place.type === "nature") typeIcon = "🌲";

        const pinIcon = L.divIcon({
          className: "custom-pin-wrapper",
          html: `
            <div class="custom-pin-badge type-${place.type}" id="marker-${place.id}">
              <span class="pin-icon-dot">${typeIcon}</span>
              <span class="pin-label">${place.name}</span>
            </div>
          `,
          iconSize: [120, 28],
          iconAnchor: [60, 14]
        });

        marker = L.marker([place.lat, place.lng], { icon: pinIcon });
      }

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        selectPlace(place.id);
      });

      marker.addTo(mapInstance);
      markersMap.set(place.id, marker);
    });
  }

  /**
   * 绘制破军学园本部辐射至校属训练场与生活设施的粉红虚线
   */
  function drawHagunConnections() {
    connectingLinesGroup.clearLayers();

    const hagun = RAKUDAI_WORLD_DATA.places.find((p) => p.isMainAnchor);
    if (!hagun) return;

    const campusPlaces = RAKUDAI_WORLD_DATA.places.filter(
      (p) => p.clusterId === "hagun_cluster" && !p.isMainAnchor
    );

    campusPlaces.forEach((p) => {
      const line = L.polyline(
        [
          [hagun.lat, hagun.lng],
          [p.lat, p.lng]
        ],
        {
          color: "#CF476F",
          weight: 1.8,
          opacity: 0.55,
          dashArray: "4, 6"
        }
      );
      connectingLinesGroup.addLayer(line);
    });
  }

  /**
   * 渲染左侧抽屉（对标 BanG Dream 圣地巡礼地图册的树状导航）
   */
  function renderSidebar() {
    const scrollArea = document.getElementById("atlas-scroll-area");
    if (!scrollArea) return;
    scrollArea.innerHTML = "";

    const groups = RAKUDAI_WORLD_DATA.groups || [];

    groups.forEach((group) => {
      const groupEl = document.createElement("div");
      groupEl.className = `group-accordion ${group.expanded ? "open" : ""}`;
      groupEl.id = `group-${group.id}`;

      // 大区标题头（如【东京 23区+多摩】）
      const groupHeader = document.createElement("div");
      groupHeader.className = "group-header";
      groupHeader.innerHTML = `
        <div class="group-header-left">
          <span class="group-tag-pill">${group.name}</span>
          <span class="group-subtitle">${group.subTitle}</span>
        </div>
        <div class="group-header-right">
          <span class="group-count-badge">${group.count}</span>
          <span class="group-chevron">▼</span>
        </div>
      `;

      groupHeader.addEventListener("click", () => {
        groupEl.classList.toggle("open");
      });

      // 子集群与树状列表容器
      const clustersList = document.createElement("div");
      clustersList.className = "group-clusters-container";

      (group.clusters || []).forEach((cluster) => {
        const clusterEl = document.createElement("div");
        clusterEl.className = "cluster-box open";
        clusterEl.id = `cluster-${cluster.id}`;

        const clusterHeader = document.createElement("div");
        clusterHeader.className = "cluster-header";
        clusterHeader.innerHTML = `
          <div class="cluster-title-wrap">
            <span class="cluster-title">${cluster.title}</span>
            <span class="cluster-region">${cluster.region}</span>
          </div>
          <div class="cluster-count-badge">${cluster.count}</div>
        `;

        clusterHeader.addEventListener("click", (e) => {
          e.stopPropagation();
          clusterEl.classList.toggle("open");

          // 点击集群标题时，地图移镜至该集群核心区域
          if (cluster.id === "hagun_cluster") {
            mapInstance.flyTo([35.6528, 139.3420], 14, { duration: 0.9 });
          } else if (cluster.id === "suburb_cluster") {
            mapInstance.flyTo([35.6550, 139.3700], 13, { duration: 0.9 });
          } else if (cluster.id === "metro_cluster") {
            mapInstance.flyTo([35.6930, 139.7200], 13, { duration: 0.9 });
          } else if (cluster.id === "okutama_cluster") {
            mapInstance.flyTo([35.8050, 139.1100], 12.5, { duration: 0.9 });
          }
        });

        // 树状条目列表 (带 ↳ 符号)
        const treeItemsList = document.createElement("div");
        treeItemsList.className = "tree-items-list";

        (cluster.placeIds || []).forEach((placeId) => {
          const place = RAKUDAI_WORLD_DATA.places.find((p) => p.id === placeId);
          if (!place) return;

          let typeDotClass = `dot-${place.type}`;

          const treeItem = document.createElement("div");
          treeItem.className = "tree-item";
          treeItem.dataset.placeId = place.id;
          treeItem.innerHTML = `
            <span class="tree-prefix">↳</span>
            <span class="tree-name">${place.name}</span>
            <span class="tree-tag-pill ${typeDotClass}">${place.tag || ""}</span>
          `;

          treeItem.addEventListener("click", (e) => {
            e.stopPropagation();
            selectPlace(place.id);
          });

          treeItemsList.appendChild(treeItem);
        });

        clusterEl.appendChild(clusterHeader);
        clusterEl.appendChild(treeItemsList);
        clustersList.appendChild(clusterEl);
      });

      groupEl.appendChild(groupHeader);
      groupEl.appendChild(clustersList);
      scrollArea.appendChild(groupEl);
    });
  }

  /**
   * 选中某地点：地图平滑飞越聚焦、高亮图钉徽章、同步侧边栏激活项并展开详情卡片
   */
  function selectPlace(placeId) {
    const place = RAKUDAI_WORLD_DATA.places.find((p) => p.id === placeId);
    if (!place) return;

    activePlaceId = placeId;

    // 1. 地图平滑飞至目标坐标 (如果在大景视角缩放至14级街区层)
    const currentZoom = mapInstance.getZoom();
    const targetZoom = currentZoom < 13 ? 14 : currentZoom;
    mapInstance.flyTo([place.lat, place.lng], targetZoom, {
      duration: 0.9,
      easeLinearity: 0.25
    });

    // 2. 侧边栏条目高亮
    document.querySelectorAll(".tree-item").forEach((el) => {
      if (el.dataset.placeId === placeId) {
        el.classList.add("active");
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        el.classList.remove("active");
      }
    });

    // 3. 地图标记高亮动画
    const marker = markersMap.get(placeId);
    if (marker && !mapInstance.hasLayer(marker)) {
      mapInstance.addLayer(marker);
    }

    document.querySelectorAll(".custom-pin-badge, .custom-marker-hagun").forEach((el) => {
      el.classList.remove("selected");
    });
    const pinEl = document.getElementById(`marker-${place.id}`);
    if (pinEl) pinEl.classList.add("selected");

    // 4. 打开详情抽屉
    openDetailModal(place);
  }

  /**
   * 渲染右上角状态胶囊
   */
  function renderStatus() {
    const status = RAKUDAI_WORLD_DATA.currentStatus;
    const pill = document.getElementById("status-pill");
    if (!pill) return;

    pill.innerHTML = `
      <span class="status-icon">📍</span>
      <span>${status.region}</span>
      <span class="divider">|</span>
      <span>☀️ ${status.weather}</span>
      <span class="divider">|</span>
      <span>📅 ${status.date}</span>
    `;
  }

  /**
   * 打开地点详情抽屉 (Detail Modal)
   */
  function openDetailModal(place) {
    const modal = document.getElementById("detail-drawer");
    if (!modal) return;

    let badgeBg = "var(--color-facility)";
    let badgeText = "設施 / 建築";
    if (place.type === "battle") {
      badgeBg = "var(--color-battle)";
      badgeText = "戰鬥 / 事件";
    } else if (place.type === "story") {
      badgeBg = "var(--color-story)";
      badgeText = "重要劇情";
    } else if (place.type === "nature") {
      badgeBg = "var(--color-nature)";
      badgeText = "自然 / 特殊地形";
    }

    const charactersHtml = (place.characters || [])
      .map((c) => `<span class="character-chip">👤 ${c}</span>`)
      .join("");

    modal.innerHTML = `
      <div class="detail-hero-wrap">
        <img src="${place.thumb}" class="detail-hero-img" alt="${place.name}" onerror="this.src='assets/p1.jpg'" />
        <div class="detail-hero-gradient"></div>
        <button class="detail-close-btn" onclick="window.RakudaiAtlas.closeDetail()">✕</button>
        <div class="detail-type-badge" style="background: ${badgeBg};">${badgeText}</div>
      </div>
      <div class="detail-content">
        <div>
          <div class="detail-title">${place.name}</div>
          <div class="detail-subtitle">${place.tag ? `「${place.tag}」` : ""}</div>
        </div>
        <div class="detail-citation-pill">
          <span>📖 原作出典：</span>
          <span>${place.bookRef || "官方設定資料"}</span>
        </div>
        ${charactersHtml ? `<div class="detail-characters-row">${charactersHtml}</div>` : ""}
        <div class="detail-body-text">${place.fullDesc || place.shortDesc}</div>
        <div class="detail-actions">
          <button class="btn-primary" onclick="window.RakudaiAtlas.travelTo('${place.id}')">
            <span>🚀 前往探索</span>
          </button>
          <button class="btn-secondary" onclick="window.RakudaiAtlas.closeDetail()">
            關閉
          </button>
        </div>
      </div>
    `;

    modal.classList.add("active");
    document.getElementById("atlas-app")?.classList.add("detail-open");
  }

  /**
   * 关闭地点详情
   */
  function closeDetailModal() {
    const modal = document.getElementById("detail-drawer");
    if (modal) modal.classList.remove("active");
    document.getElementById("atlas-app")?.classList.remove("detail-open");
    document.querySelectorAll(".tree-item").forEach((el) => el.classList.remove("active"));
    document.querySelectorAll(".custom-pin-badge, .custom-marker-hagun").forEach((el) => {
      el.classList.remove("selected");
    });
    activePlaceId = null;
  }

  /**
   * 搜索功能（支持地名、人物、剧情标签模糊检索并高亮地图与侧边栏）
   */
  function initSearch() {
    const searchInput = document.getElementById("search-input");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
      const keyword = e.target.value.trim().toLowerCase();
      if (!keyword) {
        // 重置所有显示
        markersMap.forEach((marker) => marker.setOpacity(1.0));
        document.querySelectorAll(".tree-item").forEach((item) => (item.style.display = "flex"));
        return;
      }

      const matchedPlaces = RAKUDAI_WORLD_DATA.places.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(keyword);
        const charMatch = (p.characters || []).some((c) => c.toLowerCase().includes(keyword));
        const descMatch = (p.fullDesc || p.shortDesc || "").toLowerCase().includes(keyword);
        const tagMatch = (p.tag || "").toLowerCase().includes(keyword);
        return nameMatch || charMatch || descMatch || tagMatch;
      });

      const matchedIds = new Set(matchedPlaces.map((p) => p.id));

      // 地图图钉过滤透明度
      markersMap.forEach((marker, id) => {
        if (matchedIds.has(id)) {
          marker.setOpacity(1.0);
        } else {
          marker.setOpacity(0.18);
        }
      });

      // 侧边栏条目过滤
      document.querySelectorAll(".tree-item").forEach((item) => {
        const pid = item.dataset.placeId;
        item.style.display = matchedIds.has(pid) ? "flex" : "none";
      });

      // 聚焦至第一个匹配点
      if (matchedPlaces.length > 0) {
        const first = matchedPlaces[0];
        mapInstance.flyTo([first.lat, first.lng], 13, { duration: 0.6 });
      }
    });
  }

  /**
   * 初始化交互控制按钮
   */
  function initControls() {
    // 缩放控制
    document.getElementById("btn-zoom-in")?.addEventListener("click", () => mapInstance.zoomIn());
    document.getElementById("btn-zoom-out")?.addEventListener("click", () => mapInstance.zoomOut());

    // 聚焦破军学园
    document.getElementById("btn-center-hagun")?.addEventListener("click", () => {
      const hagun = RAKUDAI_WORLD_DATA.places.find((p) => p.isMainAnchor);
      if (hagun) {
        mapInstance.flyTo([hagun.lat, hagun.lng], 14, { duration: 1.0 });
      }
    });

    // 重置东京全域大景视角
    document.getElementById("btn-locate")?.addEventListener("click", () => {
      const view = RAKUDAI_WORLD_DATA.views.tokyo || { center: [35.6600, 139.4200], zoom: 11 };
      mapInstance.flyTo(view.center, view.zoom, { duration: 1.2 });
      closeDetailModal();
    });

    // 切换折叠左侧侧边栏
    const toggleSidebar = () => {
      const sidebar = document.querySelector(".atlas-sidebar");
      if (sidebar) sidebar.classList.toggle("collapsed");
    };
    document.getElementById("btn-toggle-sidebar")?.addEventListener("click", toggleSidebar);
    document.getElementById("btn-close-sidebar")?.addEventListener("click", toggleSidebar);

    // 图例类型过滤点击
    document.querySelectorAll(".legend-item").forEach((item) => {
      item.addEventListener("click", () => {
        const type = item.dataset.type;
        markersMap.forEach((marker, id) => {
          const place = RAKUDAI_WORLD_DATA.places.find((p) => p.id === id);
          if (place) {
            if (place.type === type || place.isMainAnchor) {
              marker.setOpacity(1.0);
            } else {
              marker.setOpacity(marker.options.opacity === 0.2 ? 1.0 : 0.2);
            }
          }
        });
      });
    });
  }

  /**
   * 樱花飘落轻量动画特效
   */
  function initPetals() {
    const container = document.getElementById("cherry-petals");
    if (!container) return;

    const PETAL_COUNT = 16;
    for (let i = 0; i < PETAL_COUNT; i++) {
      const petal = document.createElement("div");
      petal.className = "petal";
      const size = Math.random() * 8 + 8;
      petal.style.width = `${size}px`;
      petal.style.height = `${size * 1.3}px`;
      petal.style.left = `${Math.random() * 100}%`;
      petal.style.animationDuration = `${Math.random() * 5 + 6}s`;
      petal.style.animationDelay = `${Math.random() * 5}s`;
      container.appendChild(petal);
    }
  }

  /**
   * 提示吐司
   */
  function alertToast(msg) {
    const toast = document.createElement("div");
    toast.className = "map-toast-pill";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      setTimeout(() => toast.remove(), 300);
    }, 2200);
  }

  /**
   * 暴露给 SillyTavern 插件、Tavern Helper、EJS 与 MVU 调用的标准桥接接口
   */
  function exposePluginBridge() {
    window.RakudaiAtlas = {
      // 外部驱动选中地点
      selectPlace: (placeId) => {
        selectPlace(placeId);
      },

      // 关闭详情
      closeDetail: closeDetailModal,

      // 玩家申请前往
      travelTo: (placeId) => {
        const place = RAKUDAI_WORLD_DATA.places.find((p) => p.id === placeId);
        if (!place) return;

        alertToast(`🚀 已申請前往【${place.name}】！正在通知宿主進行劇情判定...`);

        // 派发自定义事件给酒馆宿主插件
        window.dispatchEvent(
          new CustomEvent("rakudai:travel", {
            detail: {
              placeId: place.id,
              placeName: place.name,
              clusterId: place.clusterId,
              bookRef: place.bookRef
            }
          })
        );

        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            {
              type: "atlas:request-travel",
              payload: {
                placeId: place.id,
                placeName: place.name,
                clusterId: place.clusterId
              }
            },
            "*"
          );
        }
      },

      // 宿主更新状态 (MVU 同步)
      updateState: (newState) => {
        if (newState.currentStatus) {
          Object.assign(RAKUDAI_WORLD_DATA.currentStatus, newState.currentStatus);
          renderStatus();
        }
        if (newState.activePlaceId) {
          selectPlace(newState.activePlaceId);
        }
      }
    };

    window.addEventListener("message", (event) => {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "atlas:state") {
        window.RakudaiAtlas.updateState(event.data.payload);
      }
    });
  }
})();
