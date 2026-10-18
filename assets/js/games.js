window.NIMO_GAMES = [
  {
    id: '945360',
    title: 'Among Us',
    cdnBase: 'https://cdn.jsdelivr.net/gh/wasmdotrip/AmongUsPort@7b6881186a73a3165ad7274b5e5dd31e3290cbfc/',
    cdnProbe: 'Build/AmongUsWeb.loader.js',
    cdnProviders: ['jsdelivr', 'jsdelivr-gcore', 'rawcdn']
  },
  {
    id: '285900',
    title: 'Gang Beasts',
    cdnBase: 'https://cdn.jsdelivr.net/gh/teaserlua/GangBeast-WebPort@main/',
    cdnProbe: 'Build/WebGLValidation.loader.js',
    cdnProviders: ['jsdelivr', 'jsdelivr-fastly', 'jsdelivr-gcore', 'rawcdn']
  },
  {
    id: '3527290',
    title: 'PEAK',
    cdnBase: 'https://cdn.jsdelivr.net/gh/wasmdotrip/Peak-Port@main/',
    cdnProbe: 'Build/WebGL.data.unityweb.part010',
    cdnProviders: ['jsdelivr', 'jsdelivr-fastly', 'jsdelivr-gcore', 'rawcdn'],
    meta: 'ÚLTIMAS DOS SEMANAS: 12 MIN'
  },
  {
    id: '2835570',
    title: 'Buckshot Roulette',
    meta: 'ÚLTIMAS DOS SEMANAS: 3.2 H'
  },
  {
    id: '367520',
    title: 'Hollow Knight',
    meta: 'ÚLTIMAS DOS SEMANAS: 5.4 H'
  },
  {
    id: '322170',
    title: 'Geometry Dash',
    cdnBase: 'https://cdn.jsdelivr.net/gh/web-dashers/web-dashers.github.io@main/',
    cdnProbe: 'assets/scripts/game/allObjects.js?latest',
    cdnProviders: ['jsdelivr', 'jsdelivr-gcore', 'rawcdn']
  },
  {
    id: '98266',
    title: 'Minecraft'
  },
  {
    id: '12100',
    title: 'Grand Theft Auto III',
    cdnBase: 'https://cdn.jsdelivr.net/gh/retrodotgg/wasmports@main/gta3/',
    cdnProbe: 'opfs-cache.js?v=20261009-worker-origin',
    cdnProviders: ['jsdelivr']
  },
  {
    id: '1388880',
    title: 'Doki Doki Literature Club!'
  },
  /* {
    id: '319510',
    title: "Five Nights at Freddy's",
    cdnBase: 'https://cdn.jsdelivr.net/gh/irv77/hd_fnaf@main/1/',
    cdnProbe: 'favicon.ico'
  }, {
    id: '332800',
    title: 'Five Nights at Freddy’s 2',
    cdnBase: 'https://cdn.jsdelivr.net/gh/irv77/hd_fnaf@main/2/',
    cdnProbe: 'src/Runtime.js',
    cdnProviders: ['rawcdn'],
    cdnProvidersExact: true
  }, {
    id: '354140',
    title: 'Five Nights at Freddy’s 3',
    cdnBase: 'https://cdn.jsdelivr.net/gh/irv77/hd_fnaf@main/3/',
    cdnProbe: 'favicon.ico'
  }, {
    id: '388090',
    title: 'Five Nights at Freddy’s 4',
    cdnBase: 'https://cdn.jsdelivr.net/gh/irv77/hd_fnaf@main/4/',
    cdnProbe: 'favicon.ico'
  }, {
    id: '871720',
    title: "Freddy Fazbear's Ultimate Custom Night",
    cdnBase: 'https://cdn.jsdelivr.net/gh/rockisdirt/ultimate-custom-night.github.io@main/',
    cdnProbe: 'src/Runtime.js',
    cdnProviders: ['jsdelivr', 'jsdelivr-fastly', 'jsdelivr-gcore', 'rawcdn']
  }, */
  {
    id: '758260',
    title: "Jetpack Joyride",
    cdnBase: 'https://cdn.jsdelivr.net/gh/retrodotgg/wasmports@main/jetpack/',
    cdnProbe: 'engine/phaser-3.24.1.min.js'
  },
  {
    id: '302895',
    title: "Subway Surfers"
  },
  {
    id: '9734614',
    title: "Polytrack",
    cdnBase: 'https://cdn.jsdelivr.net/gh/Hikidsmmmm/Polytrack-0.6.0@main/',
    cdnProbe: 'simulation_worker.bundle.js'
  },
  /* {
    id: '493632',
    title: 'Skate 3',
    cdnBase: 'https://cdn.jsdelivr.net/gh/retrodotgg/wasmports@main/skate3/',
    cdnProbe: 'main.js?v=b3e0ad12bba2',
    cdnProviders: ['jsdelivr-gcore', 'jsdelivr-fastly', 'jsdelivr', 'rawcdn']
  }, */
  {
    id: '3314790',
    title: 'CloverPit',
    cdnBase: 'https://cdn.jsdelivr.net/gh/web-ports/clover-pit@main/',
    cdnProbe: 'Build/CloverPit.loader.js',
    cdnProviders: ['jsdelivr', 'jsdelivr-fastly', 'jsdelivr-gcore']
  },
  {
    id: '198666',
    title: 'Ragdoll Archers',
  },
  {
    id: '142609',
    title: 'Pou',
  },
  {
    id: '5493605',
    title: 'Shift at Midnight',
  },
  {
    id: '616603',
    title: 'UNDERTALE Yellow',
  },
  {
    id: '11913',
    title: 'Uno',
    cdnBase: 'https://cdn.jsdelivr.net/gh/nimogamesdev/ng-source@main/game10/',
    cdnProbe: 'js/main.js',
    cdnProviders: ['jsdelivr', 'jsdelivr-gcore', 'rawcdn']
  }

].map(game => {
  const artworkBase = `https://cdn-ngames.pages.dev/images/${game.id}`;
  return {
    ...game,
    hero: `${artworkBase}/hero.webp`,
    portrait: `${artworkBase}/portrait.webp`,
    logo: `${artworkBase}/logo.webp`,
    playUrl: `games/${game.id}/index.html`
  };
});
