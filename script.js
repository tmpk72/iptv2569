document.addEventListener('DOMContentLoaded', () => {
    const channelList = document.getElementById('channel-list');
    const videoPlayer = document.getElementById('video-player');
    let hls = null;

    // เปลี่ยนไปใช้ Proxy ตัวที่ 3 ที่อาจจะเสถียรกว่าสำหรับ IP/HTTP ที่มีปัญหา
    // Proxy นี้จะพยายามดึงไฟล์ HLS และ Segment โดยเลี่ยง CORS
    const PROXY_URL = 'https://thingproxy.freeboard.io/fetch/';
    
    const playChannel = (url) => {
        // ทำลาย hls instance เก่าก่อน
        if (hls) {
            hls.destroy();
        }
        
        // 1. ตรวจสอบว่าเป็นลิงก์ CCTV6 IP ที่มีปัญหาหรือไม่
        // (ใช้การตรวจสอบ IP Address ที่ไม่เป็นมิตรกับ CORS)
        const isCCTV6 = url.includes('112.27.235.94');
        
        // 2. ถ้าเป็น CCTV6 ให้ใช้ Proxy สำหรับการโหลด Manifest, ช่องอื่นใช้ URL ตรง
        let initialUrl = isCCTV6 ? (PROXY_URL + url) : url;

        if (Hls.isSupported()) {
            hls = new Hls({
                p2p: false, 
                lowLatencyMode: true,
                
                // 3. กำหนด xhrSetup: ใช้ Proxy สำหรับ Segment ของ CCTV6 เท่านั้น
                // (Segment คือไฟล์ .ts หรือ .m3u8 ย่อย ๆ ที่ HLS ต้องดึงเพิ่ม)
                xhrSetup: function(xhr, xhrUrl) {
                    // ใช้ Proxy สำหรับ Segment ของ CCTV6 เท่านั้น
                    if (isCCTV6) {
                        // ต้องแปลงเป็น URL สมบูรณ์ก่อนส่งไป Proxy เพื่อให้ถูกต้อง
                        // ใช้ URL constructor เพื่อสร้าง URL เต็ม (Absolute URL) จาก URL ฐานของช่อง
                        const absoluteUrl = new URL(xhrUrl, url).href;
                        xhr.open('GET', PROXY_URL + absoluteUrl, true);
                    }
                }
            });
            
            // โหลด Source: CCTV6 จะใช้ Proxy, ช่องอื่นใช้ URL ตรง (เช่น CCTV4)
            hls.loadSource(initialUrl); 
            
            hls.attachMedia(videoPlayer);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoPlayer.play();
            });
            
            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS Error:', data.details, data.fatal);
                if (data.fatal) {
                    console.error('Fatal HLS Error:', data.details);
                }
            });

        } 
        // สำหรับ Safari หรือเบราว์เซอร์ที่รองรับ M3U8 โดยตรง
        else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            videoPlayer.src = url;
            videoPlayer.addEventListener('loadedmetadata', () => {
                videoPlayer.play();
            });
        }
    };

    const loadChannels = async () => {
        try {
            const response = await fetch('channels.json');
            const channels = await response.json();

            channels.forEach(channel => {
                const button = document.createElement('button');
                button.classList.add('channel-button');
                button.textContent = channel.name;
                
                button.addEventListener('click', () => {
                    document.querySelectorAll('.channel-button').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    playChannel(channel.url);
                });
                channelList.appendChild(button);
            });

            if (channels.length > 0) {
                document.querySelector('.channel-button').click();
            }

        } catch (error) {
            console.error('Error loading channels:', error);
            channelList.innerHTML = '<p>ไม่สามารถโหลดรายการช่องได้ โปรดตรวจสอบไฟล์ channels.json</p>';
        }
    };

    loadChannels();
});
