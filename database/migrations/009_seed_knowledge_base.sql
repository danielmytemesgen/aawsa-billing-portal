
-- Seed the knowledge base with some initial articles
INSERT INTO public.knowledge_base_articles (title, content, category, keywords) VALUES
(
    'How to Reset Your Password',
    'To reset your password, go to the login page and click on the "Forgot Password" link. You will receive an email with instructions on how to reset your password.',
    'Account Management',
    '{"password", "reset", "account"}'
),
(
    'How to View Your Bills',
    'To view your bills, log in to your account and navigate to the "Billing" section. You will see a list of all your past and current bills.',
    'Billing',
    '{"billing", "bills", "view"}'
),
(
    'How to Make a Payment',
    'To make a payment, go to the "Billing" section and select the bill you want to pay. You can pay using a credit card or a bank transfer.',
    'Payments',
    '{"payment", "pay", "billing"}'
);
