// config/render.js - Configurazione specifica per Render
export const renderConfig = {
  // Auto-detect Render environment
  isRender: process.env.RENDER === 'true' || 
            process.env.RENDER_SERVICE_ID || 
            process.env.RENDER_EXTERNAL_URL,
            
  // Render-specific settings
  getRenderConfig() {
    if (this.isRender) {
      const serviceName = process.env.RENDER_SERVICE_NAME || 
                         process.env.RENDER_EXTERNAL_URL?.split('//')[1]?.split('.')[0];
      
      return {
        NODE_ENV: 'production',
        HTTPS: 'true',
        RP_ID: `${serviceName}.onrender.com`,
        ORIGIN: `https://${serviceName}.onrender.com`,
        PORT: process.env.PORT || 10000
      };
    }
    return {};
  }
};

// Auto-apply configuration if on Render
if (renderConfig.isRender) {
  const config = renderConfig.getRenderConfig();
  Object.assign(process.env, config);
  
  console.log('🚀 Auto-configured for Render:', config);
}