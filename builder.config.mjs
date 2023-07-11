import autoprefixer from 'autoprefixer';

/** @param {import("webpack").Configuration} config */
export function webpack(config) {
    const rules = [{
            test: /\.(scss)$/,
        }]
    config.module.rules = [...config.module?.rules, ...rules]
    return config;
}