-- ============================================================================
-- TKBS-Hub — 0004: track the full tkbs-support roster (discovered 2026-07-10
-- via the org token; 10 repos the original registry didn't know about).
-- Purposes come from the GitHub repo descriptions where set — never invented.
-- Categories are best-guess and editable in the app.
-- ============================================================================

insert into public.repos (provider, org, name, category, purpose, default_branch) values
('github', 'tkbs-support', 'Customer-Dashboards',        'client',   null, 'main'),
('github', 'tkbs-support', 'Electrician-CRM',            'internal', null, 'init-crm-mvp'),
('github', 'tkbs-support', 'Foundations-Tree-Experts',   'client',   'Website for FTE Hosting', 'main'),
('github', 'tkbs-support', 'Honest-Mortgage',            'client',   null, 'main'),
('github', 'tkbs-support', 'Honest-Mortgage-Website',    'client',   null, 'main'),
('github', 'tkbs-support', 'Options-Trader',             'internal', null, 'main'),
('github', 'tkbs-support', 'RMD-Klaviyo-Integration',    'client',   null, 'main'),
('github', 'tkbs-support', 'Shopify-Website-Builder',    'internal', 'Learning repo for integrating with Shopify themes and building/altering site pages through them', 'main'),
('github', 'tkbs-support', 'Sunsy-Content-Pipeline',     'client',   null, 'main'),
('github', 'tkbs-support', 'Sunsy-Klaviyo-Welcome-Flows','client',   'Builder for the Sunsy Klaviyo Welcome Flows', 'main')
on conflict (provider, org, name) do nothing;

-- Foundations-Tree-Experts repo belongs to the Foundations Tree Experts client
update public.repos r
   set client_id = c.id
  from public.clients c
 where r.org = 'tkbs-support'
   and r.name = 'Foundations-Tree-Experts'
   and c.slug = 'foundations-tree-experts';
