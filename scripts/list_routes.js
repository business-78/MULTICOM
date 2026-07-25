const routes = require('../routes');
function listRoutes(router, prefix=''){
  if (!router || !router.stack) return;
  router.stack.forEach(layer => {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
      console.log(methods, prefix + layer.route.path);
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      listRoutes(layer.handle, prefix + (layer.regexp && layer.regexp.source ? '' : ''));
    }
  });
}
listRoutes(routes);