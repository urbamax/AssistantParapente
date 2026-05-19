import os

css_additions = """
/* --- REFACTORED CLASSES --- */
.app-card.sites-mode { background: rgba(255, 122, 0, 0.08); border-color: rgba(255, 122, 0, 0.25); }
.app-card.stats-mode { filter: grayscale(1); }
.setup-grid { display: grid; gap: 24px; max-width: 800px; margin: 0 auto; }
.mode-description { background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-top: -16px; margin-bottom: 24px; font-size: 0.9rem; opacity: 0.8; font-style: italic; }
.setup-group-margin { margin-top: 24px; }
.next-btn-large { margin-top: 32px; padding: 20px; font-size: 1.2rem; }
.bank-btn { margin-top: 16px; background: transparent; border: 1px solid rgba(255,255,255,0.2); width: 100%; padding: 15px; border-radius: 12px; cursor: pointer; color: var(--text-secondary); transition: all 0.2s; }
.bank-btn:hover { background: rgba(255,255,255,0.05); border-color: var(--text-main); color: var(--text-main); }
.level-tag-faded { opacity: 0.5; }
.qcm-feedback { font-size: 1rem; margin-top: 30px; border-left: 2px solid white; padding-left: 20px; }
.section-title-center { text-align: center; font-size: 1.5rem; margin-bottom: 32px; }
.section-title-sites { text-align: center; font-size: 1.5rem; margin-bottom: 20px; }
.flex-column-gap16 { display: flex; flex-direction: column; gap: 16px; }
.course-pdf-frame { border: none; }
.sites-map-view { width: 100%; margin-bottom: 24px; display: flex; flex-direction: column; gap: 12px; }
.map-toggles-container { display: flex; justify-content: space-between; align-items: center; gap: 12px; width: 100%; flex-wrap: wrap; }
.map-toggles-left { display: flex; gap: 8px; }
.map-toggle-btn { padding: 8px 16px; font-size: 0.85rem; font-weight: 600; border-radius: var(--radius-pill); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.sites-map-canvas { width: 100%; height: 400px; border-radius: var(--radius-lg); border: 1px solid var(--border-color); background: var(--bg-surface); z-index: 1; display: block; }
.sites-windy-canvas { width: 100%; height: 440px; border-radius: var(--radius-lg); border: 1px solid var(--border-color); background: var(--bg-surface); overflow: hidden; display: none; flex-direction: column; }
.windy-active-spot-header { width: 100%; background: var(--bg-surface); border-bottom: 1px solid var(--border-color); padding: 12px 16px; display: flex; align-items: center; gap: 8px; font-family: var(--font-main); font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.windy-spot-icon { color: var(--accent-blue); font-size: 1rem; }
.windy-spot-name { color: var(--text-main); font-weight: 800; font-size: 0.9rem; }
.sites-iframe { border: none; flex: 1; }
.sites-isofronts-canvas { width: 100%; height: 440px; border-radius: var(--radius-lg); border: 1px solid var(--border-color); background: var(--bg-surface); overflow: hidden; display: none; flex-direction: column; }
.isofronts-header { width: 100%; background: var(--bg-surface); border-bottom: 1px solid var(--border-color); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-family: var(--font-main); font-size: 0.85rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; flex-wrap: wrap; }
.isofronts-header-left { display: flex; align-items: center; gap: 8px; }
.isofronts-header-right { display: flex; gap: 12px; align-items: center; text-transform: none; font-size: 0.8rem; font-weight: 600; }
.isofronts-toggle-btn { background: rgba(255,255,255,0.08); color: var(--text-main); border: 1px solid var(--border-color); padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600; cursor: pointer; }
.isofronts-link { color: var(--accent-blue); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
.isofronts-img-container { flex: 1; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #ffffff; overflow: auto; position: relative; }
.isofronts-img { max-width: 100%; max-height: 100%; object-fit: contain; cursor: zoom-in; }
.forecast-slider-container { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-lg); }
.slider-row { display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; }
.slider-labels { display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem; font-weight: 500; flex-wrap: wrap; gap: 8px; }
.slider-label-left { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); }
.slider-label-right { color: var(--accent-blue); font-weight: 600; }
.slider-input { width: 100%; cursor: pointer; }
.weather-settings-details { width: 100%; }
.weather-settings-col { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; }
.weather-model-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.settings-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.settings-select { background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-main); padding: 5px 10px; border-radius: var(--radius-md); outline: none; font-size: 0.85rem; font-weight: 500; cursor: pointer; }
.wind-limits-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 12px; }
.wind-limits-label-full { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; width: 100%; }
.wind-limit-group { display: flex; align-items: center; gap: 6px; }
.wind-limit-label { font-size: 0.75rem; color: var(--text-muted); }
.wind-limit-input { width: 50px; background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-main); padding: 4px 6px; border-radius: var(--radius-sm); text-align: center; outline: none; font-size: 0.8rem; }
.radius-slider-container { display: none; flex-direction: column; gap: 6px; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 12px; margin-top: 4px; }
.radius-slider-header { display: flex; align-items: center; justify-content: space-between; }
.radius-slider-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px; }
.radius-slider-val { font-size: 0.85rem; font-weight: 700; color: var(--accent-blue); }
.toolbar-global { display: flex; gap: 12px; margin-bottom: 24px; position: relative; z-index: 10; width: 100%; flex-wrap: wrap; }
.sort-select { width: 100%; background: var(--bg-input); color: var(--text-main); border: 1px solid var(--border-color); border-radius: var(--radius-pill); padding: 12px 32px 12px 16px; font-family: var(--font-main); font-size: 0.9rem; font-weight: 600; outline: none; cursor: pointer; -webkit-appearance: none; -moz-appearance: none; appearance: none; background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22></polyline></svg>'); background-repeat: no-repeat; background-position: right 12px center; background-size: 16px; transition: all 0.2s; }
.conditions-strategy-panel { display: flex; flex-direction: column; gap: 8px; margin-top: -12px; margin-bottom: 24px; width: 100%; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 12px 16px; backdrop-filter: blur(10px); transition: all 0.3s ease; }
.strategy-panel-label { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.strategy-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.strategy-btn { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: var(--text-secondary); padding: 8px 14px; border-radius: var(--radius-pill); font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.strategy-btn.active { background: rgba(14,165,233,0.15); border: 1px solid rgba(14,165,233,0.3); color: var(--accent-blue); }
.sites-list-view { display: flex; flex-direction: column; gap: 16px; width: 100%; }
.sites-list-container { display:flex; flex-direction:column; gap:16px; width: 100%; }
"""

with open('/Volumes/maximeurbaniak/TheorieParapente/css/style.css', 'a', encoding='utf-8') as f:
    f.write(css_additions)
print("Added css classes")
