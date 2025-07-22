import Joi from "joi";

const pick = (object, keys) => {
  return keys.reduce((obj, key) => {
    if (object && Object.prototype.hasOwnProperty.call(object, key)) {
      obj[key] = object[key];
    }
    return obj;
  }, {});
};

export const validationMiddleware = (schema) => (req, res, next) => {
  const validSchema = pick(schema, ["params", "query", "body"]);
  const object = pick(req, Object.keys(validSchema));
  
  // Add debugging for create listing requests
  if (req.path.includes('/listings') && req.method === 'POST') {
    console.log('🔍 VALIDATION DEBUG - Create Listing Request:', {
      path: req.path,
      method: req.method,
      bodyKeys: Object.keys(req.body || {}),
      body: req.body,
      validSchemaKeys: Object.keys(validSchema)
    });
  }
  
  const { value, error } = Joi.compile(validSchema)
    .prefs({ errors: { label: "key" }, abortEarly: false })
    .validate(object);

  if (error) {
    console.log('❌ VALIDATION ERROR:', {
      path: req.path,
      method: req.method,
      errors: error.details.map(d => ({ field: d.path, message: d.message, value: d.context?.value }))
    });
    
    const errorMessage = error.details
      .map((details) => details.message)
      .join(", ");
    return res.status(400).json({ success: false, errors: errorMessage });
  }
  Object.assign(req, value);
  return next();
}; 