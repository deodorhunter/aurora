/**
 * This is the server side config entry point
 */
import config from '@plone/registry';
import PloneClient from '@plone/client';
// eslint-disable-next-line import/no-unresolved
import applyAddonConfiguration from '../../.plone/registry.loader';
// eslint-disable-next-line import/no-unresolved
import applyServerAddonConfiguration from '../../.plone/registry.loader.server';

import type { ContentExpander } from '@plone/types';
import installMigrations from './server/migrations.server';

/**
 * The components that the main content request expands by default. Add-ons
 * can add to, change, or remove them through `config.settings.apiExpanders`.
 */
export const defaultApiExpanders: ContentExpander[] = [
  { match: '', expand: ['navroot', 'breadcrumbs', 'navigation', 'actions'] },
  { match: '', expand: ['types'], authenticated: true },
];

export default function install() {
  config.settings.apiPath =
    process.env.PLONE_API_PATH || 'http://localhost:8080/Plone';

  config.settings.apiExpanders = [...defaultApiExpanders];

  config.registerUtility({
    name: 'ploneClient',
    type: 'client',
    method: () => PloneClient,
  });

  installMigrations();

  config.settings.defaultLanguage = 'en';
  config.settings.supportedLanguages = ['en'];

  applyAddonConfiguration(config);
  applyServerAddonConfiguration(config);

  return config;
}
