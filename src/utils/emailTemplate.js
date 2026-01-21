// utils/emailTemplate.js

module.exports = function htmlTemplate(
  usuario,
  content,
  title,
  subtitle,
  type = "link",
  buttonText = "",
  link = ""
) {
  // 1. CONFIGURACIÓN DE ESTILOS SEGÚN EL TIPO
  let mainContent = "";

  if (type === "code") {
    // Estilo para CÓDIGOS (Caja punteada)
    mainContent = `
      <div style="font-size:28px; letter-spacing:4px; font-weight:bold; color:#E0CEAC; background:#0C0C0C; border:2px dashed #7C6447; border-radius:12px; padding:20px 40px; display:inline-block; margin-top:15px;">
           ${content}
      </div>`;
  } 
  else if (type === "link") {
    // Estilo para BOTONES (Enlace)
    mainContent = `
      <a href="${link}" style="background:linear-gradient(135deg,#E0CEAC,#7C6447); color:#0C0C0C; text-decoration:none; padding:14px 28px; border-radius:12px; font-weight:bold; display:inline-block; margin-top:15px;">
           ${buttonText}
      </a>`;
  } 
  else if (type === "note") {
    // NUEVO: Estilo para NOTAS DEL ADMIN (Texto limpio y ordenado)
    // Usa un fondo semitransparente sutil y una barra lateral dorada
    mainContent = `
      <div style="text-align: left; background-color: rgba(255, 255, 255, 0.05); border-left: 4px solid #E0CEAC; border-radius: 4px; padding: 20px; margin-top: 20px; color: #F5F4E7;">
        <p style="margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; font-style: italic;">
          "${content}"
        </p>
        <p style="margin-top: 10px; font-size: 12px; color: #E0CEAC; font-weight: bold; text-align: right;">
          — Administración Pitts Bowling
        </p>
      </div>`;
  }

  // 2. RETORNO DE LA PLANTILLA GENERAL
  return `
  <table width="100%" cellspacing="0" cellpadding="0" style="font-family:'Poppins', 'Helvetica Neue', Arial, sans-serif; background:#0C0C0C; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellspacing="0" cellpadding="0" style="background:#1C211B; border-radius:20px; border: 1px solid #333; overflow:hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <tr>
            <td align="center" style="padding: 30px 40px 0 40px;">
              <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQEXgCjUjwZ-Is2PQ7RBCzfmtbco61kgM6YmQ&s" alt="Pitts Bowling" width="80" style="border-radius:50%; border:2px solid #7C6447;" />
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 15px 40px;">
              <h2 style="color:#E0CEAC; font-size:24px; margin:0; font-weight:600; letter-spacing: 1px;">
                ${title}
              </h2>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 0 40px 30px 40px;">
              <p style="font-size:16px; line-height:1.6; color:#cccccc; margin-bottom: 10px;">
                Hola <strong style="color:#fff;">${usuario}</strong>,
              </p>
              <p style="font-size:16px; line-height:1.6; color:#cccccc; margin:0;">
                ${subtitle}
              </p>
              
              ${mainContent}

            </td>
          </tr>

          <tr>
            <td align="center" style="background-color:#151914; padding: 20px; font-size:12px; color:#666; border-top: 1px solid #333;">
              <p style="margin:0;">Si tienes dudas, contáctanos directamente en el local.</p>
              <p style="margin:5px 0 0 0;">© ${new Date().getFullYear()} Pitts Bowling. Todos los derechos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `;
};