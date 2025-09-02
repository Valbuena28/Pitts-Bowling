  // Funcionalidad de la sección de desarrolladores
document.addEventListener('DOMContentLoaded', () => {
    const developersToggle = document.querySelector('.developers-toggle');
    const developersInfo = document.querySelector('.developers-info');
    const devTeamTitle = document.getElementById('dev-team-title');
    const developersSection = document.getElementById('developers-section');

    if (developersToggle && developersInfo && devTeamTitle && developersSection) {
        
        const closeSection = () => {
            if (developersInfo.classList.contains('active')) {
                developersInfo.classList.remove('active');
                developersToggle.classList.remove('active');
                devTeamTitle.style.opacity = '0';
            }
        };

        const openSection = () => {
            if (!developersInfo.classList.contains('active')) {
                developersInfo.classList.add('active');
                developersToggle.classList.add('active');
                devTeamTitle.style.opacity = '1';
            }
        };

        developersToggle.addEventListener('click', () => {
            if (developersInfo.classList.contains('active')) {
                closeSection();
            } else {
                openSection();
            }
        });

        developersSection.addEventListener('mouseleave', closeSection);

        let lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        window.addEventListener('scroll', () => {
            let st = window.pageYOffset || document.documentElement.scrollTop;
            if (st < lastScrollTop) {
                closeSection();
            }
            lastScrollTop = st <= 0 ? 0 : st;
        }, false);
    }
});

// Funcionalidad del menú de hamburguesa
    const mobileMenu = document.getElementById('mobile-menu');
    const mainNav = document.getElementById('main-nav');

    if (mobileMenu && mainNav) {
        mobileMenu.addEventListener('click', () => {
            mobileMenu.classList.toggle('active');
            mainNav.classList.toggle('active');
        });
    }

// Funcionalidad del Chatbot y Scroll-to-Top
document.addEventListener('DOMContentLoaded', () => {
    // Scroll to top button functionality
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 200) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        });

        scrollToTopBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Chatbot functionality
    const chatFab = document.querySelector('.chat-fab');
    const chatbotContainer = document.getElementById('chatbotContainer');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatbotMessages = document.getElementById('chatbotMessages');
    const chatbotHeaderAvatar = document.querySelector('.chatbot-header .avatar');
    const apiKey = 'AIzaSyBDv0y9MVBZ8r2UK8yVEqTytV8rFIIWrws';
    const websiteContext = document.body.innerText;

    if (chatFab && chatbotContainer && chatInput && chatSendBtn && chatbotMessages) {
        const toggleChatbot = (show) => {
            chatbotContainer.classList.toggle('visible', show);
        };

        chatFab.addEventListener('click', (e) => {
            e.preventDefault();
            toggleChatbot(!chatbotContainer.classList.contains('visible'));
        });
        
        chatbotContainer.addEventListener('mouseleave', () => toggleChatbot(false));

        const displayMessage = (text, type, avatar) => {
            const message = document.createElement('div');
            message.classList.add('message', type);
            const avatarImg = (type === 'user-message') 
                ? `<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzMzMyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MxLjY2IDAgMyAxLjM0IDMgM3MtMS4zNCAzLTMgMy0zLTEuMzQtMy0zIDEuMzQtMyAzLTN6bTAgMTRjLTIuNjcgMC01LTEuMjgtNi42Ny0zLjIyLjI0LS45OCAxLjUzLTEuNzggMy4xNy0yLjE4IDQuNTMtMS4xMyA3LjMyLjU1IDcuNSA1LjQyQzE3LjE3IDE3Ljc1IDE0LjggMTkgMTIgMTl6Ii8+PC9zdmc+" alt="User" class="avatar">`
                : `<img src="https://i.ibb.co/1nC1g6x/avatar.png" alt="Lia" class="avatar">`;

            const messageContent = (type === 'user-message')
                ? `<p>${text}</p>${avatarImg}`
                : `${avatarImg}<p>${text}</p>`;

            message.innerHTML = messageContent;
            chatbotMessages.appendChild(message);
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
            return message;
        };

        const getAIResponse = async (prompt) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
            const fullPrompt = `
                Eres "Lia", una asistente virtual amigable para "Pitts Bowling".
                Responde preguntas sobre Pitts Bowling basándote en la siguiente información.
                Si una pregunta no está relacionada con Pitts Bowling o la información proporcionada,
                responde amablemente: "Lo siento, solo puedo responder preguntas sobre Pitts Bowling."
                Se breve y directo.

                Contexto del sitio web:
                ---
                ${websiteContext}
                ---

                Pregunta del usuario: "${prompt}"

                Respuesta:`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }]
                })
            });

            if (!response.ok) {
                return "Lo siento, estoy teniendo problemas para conectarme. Por favor, inténtalo de nuevo más tarde.";
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        };

        const handleSendMessage = async () => {
            const messageText = chatInput.value.trim();
            if (messageText === '') return;

            displayMessage(messageText, 'user-message');
            chatInput.value = '';

            // Cambiar el avatar del encabezado a "Pensando"
            if (chatbotHeaderAvatar) {
                chatbotHeaderAvatar.src = '/gifs/Pensando.gif';
            }

            const typingIndicator = document.createElement('div');
            typingIndicator.classList.add('message', 'bot-message');
            typingIndicator.innerHTML = `
                <img src="/gifs/Pensando.gif" alt="FABI" class="avatar">
                <div class="typing-indicator"><span></span><span></span><span></span></div>`;
            chatbotMessages.appendChild(typingIndicator);
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

            const aiResponseText = await getAIResponse(messageText);
            
            chatbotMessages.removeChild(typingIndicator);
            displayMessage(aiResponseText, 'bot-message');

            // Volver el avatar del encabezado a "Hablando"
            if (chatbotHeaderAvatar) {
                chatbotHeaderAvatar.src = 'gifs/Hablando.gif';
            }
        };

        chatSendBtn.addEventListener('click', handleSendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSendMessage();
        });
    }
});
