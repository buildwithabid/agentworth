-- The three founder accounts were created before the profiles trigger existed,
-- so they had no profile and therefore no access. Backfill them with the roles
-- the founders' agreement describes: Founder A technical/admin, B and C sales.
insert into public.profiles (id, email, full_name, role)
select u.id, u.email,
       case u.email
         when 'aitechpro1987@gmail.com'     then 'Abid Ali'
         when 'ikhtishamulhaq811@gmail.com' then 'Ikhtisham Ul Haq'
         when 'mrehbarkhan999@gmail.com'    then 'Muhammad Rehbar'
         else split_part(u.email, '@', 1)
       end,
       case u.email
         when 'aitechpro1987@gmail.com'     then 'admin'
         when 'ikhtishamulhaq811@gmail.com' then 'sales'
         when 'mrehbarkhan999@gmail.com'    then 'sales'
         else 'pending'
       end
from auth.users u
on conflict (id) do update
  set full_name = excluded.full_name, role = excluded.role;
