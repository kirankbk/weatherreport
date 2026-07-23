
(function(){
  "use strict";

  const heroArea = document.getElementById('heroArea');
  const belowSky = document.getElementById('belowSky');
  const forecastStrip = document.getElementById('forecastStrip');
  const advisoryArea = document.getElementById('advisoryArea');
  const detailGrid = document.getElementById('detailGrid');
  const searchInput = document.getElementById('searchInput');
  const suggestions = document.getElementById('suggestions');
  const geoBtn = document.getElementById('geoBtn');
  const updatedAt = document.getElementById('updatedAt');

  const MARATHI_DAYS = ['रवि','सोम','मंगळ','बुध','गुरु','शुक्र','शनि'];
  const MARATHI_MONTHS = ['जाने','फेब्रु','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टें','ऑक्टो','नोव्हें','डिसें'];

  // WMO weather code -> {icon, marathi description}
  const WEATHER_CODES = {
    0:{ic:'☀️',t:'निरभ्र आकाश'},
    1:{ic:'🌤️',t:'बहुतांश निरभ्र'},
    2:{ic:'⛅',t:'अंशतः ढगाळ'},
    3:{ic:'☁️',t:'ढगाळ आकाश'},
    45:{ic:'🌫️',t:'धुके'},
    48:{ic:'🌫️',t:'दाट धुके'},
    51:{ic:'🌦️',t:'हलकी रिमझिम'},
    53:{ic:'🌦️',t:'मध्यम रिमझिम'},
    55:{ic:'🌧️',t:'दाट रिमझिम'},
    56:{ic:'🌧️',t:'बर्फाळ रिमझिम'},
    57:{ic:'🌧️',t:'दाट बर्फाळ रिमझिम'},
    61:{ic:'🌦️',t:'हलका पाऊस'},
    63:{ic:'🌧️',t:'मध्यम पाऊस'},
    65:{ic:'⛈️',t:'मुसळधार पाऊस'},
    66:{ic:'🌧️',t:'गोठणारा पाऊस'},
    67:{ic:'🌧️',t:'तीव्र गोठणारा पाऊस'},
    71:{ic:'🌨️',t:'हलकी हिमवृष्टी'},
    73:{ic:'🌨️',t:'मध्यम हिमवृष्टी'},
    75:{ic:'❄️',t:'तीव्र हिमवृष्टी'},
    77:{ic:'❄️',t:'हिमकण'},
    80:{ic:'🌦️',t:'हलक्या सरी'},
    81:{ic:'🌧️',t:'मध्यम सरी'},
    82:{ic:'⛈️',t:'तीव्र सरी'},
    85:{ic:'🌨️',t:'हलक्या हिमसरी'},
    86:{ic:'❄️',t:'तीव्र हिमसरी'},
    95:{ic:'⛈️',t:'मेघगर्जनेसह वादळ'},
    96:{ic:'⛈️',t:'गारपिटीसह वादळ'},
    99:{ic:'⛈️',t:'तीव्र गारपिटीसह वादळ'}
  };

  function wcode(code){ return WEATHER_CODES[code] || {ic:'🌡️', t:'माहिती अनुपलब्ध'}; }

  function formatMarathiDate(d){
    return `${d.getDate()} ${MARATHI_MONTHS[d.getMonth()]}, ${MARATHI_DAYS[d.getDay()]}वार`;
  }

  // ---------- Location search (Open-Meteo geocoding) ----------
  let searchTimer = null;
  searchInput.addEventListener('input', ()=>{
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if(q.length < 2){ suggestions.classList.remove('show'); return; }
    searchTimer = setTimeout(()=>doSearch(q), 350);
  });

  async function doSearch(q){
    try{
	debugger;
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
      const data = await res.json();
      renderSuggestions(data.results || []);
    }catch(e){
      suggestions.classList.remove('show');
    }
  }

  function renderSuggestions(results){
    if(!results.length){ suggestions.classList.remove('show'); return; }
    suggestions.innerHTML = results.map(r=>{
      const region = [r.admin1, r.country].filter(Boolean).join(', ');
      return `<div class="suggestion-item" data-lat="${r.latitude}" data-lon="${r.longitude}" data-name="${r.name}">
                ${r.name}<small>${region}</small>
              </div>`;
    }).join('');
    suggestions.classList.add('show');
    suggestions.querySelectorAll('.suggestion-item').forEach(el=>{
      el.addEventListener('click', ()=>{
        loadWeather(parseFloat(el.dataset.lat), parseFloat(el.dataset.lon), el.dataset.name);
        suggestions.classList.remove('show');
        searchInput.value = '';
      });
    });
  }

  document.getElementById('quickChips').addEventListener('click', (e)=>{
    const chip = e.target.closest('.chip');
    if(!chip) return;
    loadWeather(parseFloat(chip.dataset.lat), parseFloat(chip.dataset.lon), chip.dataset.name);
  });

  geoBtn.addEventListener('click', ()=>{
    if(!navigator.geolocation){
      alert('या ब्राउझरमध्ये स्थान सुविधा उपलब्ध नाही.');
      return;
    }
    geoBtn.textContent = '📍 शोधत आहे…';
    navigator.geolocation.getCurrentPosition(
      pos=>{
        geoBtn.textContent = '📍 माझे स्थान';
        loadWeather(pos.coords.latitude, pos.coords.longitude, 'सध्याचे स्थान');
      },
      ()=>{
        geoBtn.textContent = '📍 माझे स्थान';
        alert('स्थान मिळवता आले नाही. कृपया गावाचे नाव टाकून शोधा.');
      }
    );
  });

  document.addEventListener('click', (e)=>{
    if(!e.target.closest('.search-wrap')) suggestions.classList.remove('show');
  });

  // ---------- Weather fetch ----------
  async function loadWeather(lat, lon, placeName){
    heroArea.innerHTML = `<div class="loading"><div class="spinner"></div><div>हवामान माहिती आणत आहे…</div></div>`;
    belowSky.style.display = 'none';
    try{
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
        + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,uv_index`
        + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max`
        + `&timezone=auto&forecast_days=7`;
      const res = await fetch(url);
      if(!res.ok) throw new Error('network');
      const data = await res.json();
      renderAll(data, placeName);
    }catch(err){
      heroArea.innerHTML = `
        <div class="error-box" style="color:#fff;">
          <div class="ic">⚠️</div>
          <div>हवामान माहिती मिळवता आली नाही.<br>कृपया इंटरनेट तपासा आणि पुन्हा प्रयत्न करा.</div>
          <button class="retry-btn" onclick="location.reload()">पुन्हा प्रयत्न करा</button>
        </div>`;
    }
  }

  function renderAll(data, placeName){
    const cur = data.current;
    const daily = data.daily;
    const wc = wcode(cur.weather_code);
    const now = new Date();

    heroArea.innerHTML = `
      <div class="hero">
        <div class="place">${placeName || 'तुमचे स्थान'}</div>
        <div class="date">${formatMarathiDate(now)}</div>
        <div class="icon-big">${wc.ic}</div>
        <div class="temp num">${Math.round(cur.temperature_2m)}°</div>
        <div class="cond">${wc.t}</div>
        <div class="feels num">जाणवते: ${Math.round(cur.apparent_temperature)}°से</div>
      </div>
      <div class="chips-row">
        <div class="mini-chip"><div class="v num">${cur.relative_humidity_2m}%</div><div class="l">आर्द्रता</div></div>
        <div class="mini-chip"><div class="v num">${Math.round(cur.wind_speed_10m)}</div><div class="l">वारा किमी/ता</div></div>
        <div class="mini-chip"><div class="v num">${cur.precipitation}</div><div class="l">पाऊस मिमी</div></div>
        <div class="mini-chip"><div class="v num">${daily.precipitation_probability_max[0]}%</div><div class="l">पाऊस शक्यता</div></div>
      </div>
    `;

    // 7-day forecast strip
    forecastStrip.innerHTML = daily.time.map((dateStr, i)=>{
      const d = new Date(dateStr);
      const dwc = wcode(daily.weather_code[i]);
      const isToday = i === 0;
      return `
        <div class="fc-card ${isToday?'today':''}">
          <div class="day">${isToday ? 'आज' : MARATHI_DAYS[d.getDay()]}</div>
          <div class="ic">${dwc.ic}</div>
          <div class="hi num">${Math.round(daily.temperature_2m_max[i])}°</div>
          <div class="lo num">${Math.round(daily.temperature_2m_min[i])}°</div>
          <div class="rain">💧${daily.precipitation_probability_max[i]}%</div>
        </div>
      `;
    }).join('');

    // Detail grid
    detailGrid.innerHTML = `
      <div class="detail-card"><div class="ic">🧭</div><div class="v num">${degToCompassMarathi(cur.wind_direction_10m)}</div><div class="l">वाऱ्याची दिशा</div></div>
      <div class="detail-card"><div class="ic">🔽</div><div class="v num">${Math.round(cur.surface_pressure)}</div><div class="l">दाब (hPa)</div></div>
      <div class="detail-card"><div class="ic">🔆</div><div class="v num">${Math.round(cur.uv_index)}</div><div class="l">UV निर्देशांक</div></div>
    `;

    // Advisory
    advisoryArea.innerHTML = buildAdvisory(cur, daily).join('');

    updatedAt.textContent = now.toLocaleTimeString('mr-IN', {hour:'2-digit', minute:'2-digit'});
    belowSky.style.display = 'block';
  }

  function degToCompassMarathi(deg){
    const dirs = ['उत्तर','ईशान्य','पूर्व','आग्नेय','दक्षिण','नैऋत्य','पश्चिम','वायव्य'];
    return dirs[Math.round(deg/45)%8];
  }

  // ---------- Farmer advisory engine ----------
  function buildAdvisory(cur, daily){
    const cards = [];
    const rainProbToday = daily.precipitation_probability_max[0];
    const rainProbTomorrow = daily.precipitation_probability_max[1];
    const tempMaxToday = daily.temperature_2m_max[0];
    const windToday = cur.wind_speed_10m;
    const humidity = cur.relative_humidity_2m;
    const uv = cur.uv_index;

    // 1. Rain / irrigation advisory
    if(rainProbToday >= 60){
      cards.push(advisoryCard('alert','🌧️','पावसाचा इशारा',
        `आज पाऊस पडण्याची शक्यता ${rainProbToday}% आहे. शेतातील पाणी साचण्याची व्यवस्था तपासा आणि काढणी केलेले धान्य सुरक्षित ठिकाणी ठेवा.`));
    } else if(rainProbToday <= 20 && tempMaxToday >= 33){
      cards.push(advisoryCard('caution','💧','सिंचनाची गरज',
        `आज पावसाची शक्यता कमी (${rainProbToday}%) आणि तापमान जास्त आहे. पिकांना सकाळी लवकर किंवा संध्याकाळी उशिरा पाणी द्या.`));
    } else {
      cards.push(advisoryCard('ok','🌱','सिंचन स्थिती सामान्य',
        `सध्याची पाऊस व तापमान स्थिती सामान्य आहे. नियमित सिंचन वेळापत्रकाप्रमाणे पाणी द्या.`));
    }

    // 2. Pesticide/fertilizer spraying advisory (wind + rain)
    if(windToday >= 20){
      cards.push(advisoryCard('caution','🌬️','फवारणी टाळा',
        `वाऱ्याचा वेग ${Math.round(windToday)} किमी/तास आहे. जास्त वाऱ्यामुळे औषध/खत फवारणी प्रभावी होणार नाही, यामुळे आज फवारणी टाळा.`));
    } else if(rainProbTomorrow >= 50){
      cards.push(advisoryCard('caution','🚫','फवारणीपूर्वी विचार करा',
        `उद्या पावसाची शक्यता ${rainProbTomorrow}% आहे. फवारणी केल्यास पाऊस औषध वाहून नेऊ शकतो, त्यामुळे आजच फवारणी पूर्ण करा किंवा पाऊस संपल्यावर करा.`));
    } else {
      cards.push(advisoryCard('ok','✅','फवारणीसाठी अनुकूल वेळ',
        `वारा व पावसाची स्थिती फवारणीसाठी अनुकूल आहे. सकाळी किंवा संध्याकाळी फवारणी करणे उत्तम.`));
    }

    // 3. Disease risk (humidity)
    if(humidity >= 80){
      cards.push(advisoryCard('alert','🦠','बुरशीजन्य रोगाचा धोका',
        `हवेतील आर्द्रता ${humidity}% इतकी जास्त आहे. यामुळे बुरशीजन्य रोग (करपा, भुरी) होण्याची शक्यता वाढते. पिकांची नियमित पाहणी करा.`));
    }

    // 4. Heat stress
    if(tempMaxToday >= 38){
      cards.push(advisoryCard('alert','🥵','उष्णतेपासून काळजी',
        `आजचे कमाल तापमान ${Math.round(tempMaxToday)}°से आहे. जनावरांना सावलीत ठेवा आणि शेतमजुरांनी दुपारी १२ ते ३ या वेळेत उन्हात काम टाळावे.`));
    }

    // 5. UV advisory
    if(uv >= 8){
      cards.push(advisoryCard('caution','🕶️','तीव्र सूर्यप्रकाश',
        `UV निर्देशांक ${Math.round(uv)} आहे. शेतात काम करताना डोके झाकून घ्या आणि पुरेसे पाणी प्यायला विसरू नका.`));
    }

    return cards;
  }

  function advisoryCard(type, icon, title, text){
    return `<div class="advisory ${type}"><div class="ic">${icon}</div><div><h4>${title}</h4><p>${text}</p></div></div>`;
  }

  // ---------- Init: try geolocation, fallback to Nagpur ----------
  function init(){
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        pos=> loadWeather(pos.coords.latitude, pos.coords.longitude, 'सध्याचे स्थान'),
        ()=> loadWeather(21.1458, 79.0882, 'नागपूर'),
        {timeout:6000}
      );
    } else {
      loadWeather(21.1458, 79.0882, 'नागपूर');
    }
  }
  init();
})();

