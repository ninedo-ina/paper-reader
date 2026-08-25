-- GROBID can merge this known Google permission statement into the main title.
-- Keep this migration deliberately narrow: only the exact normalized prefix is
-- removed, and only when non-empty alphanumeric title content remains.
WITH title_cleanup AS (
    SELECT
        id,
        BTRIM(SUBSTRING(title FROM CHAR_LENGTH(
            'Provided proper attribution is provided, Google hereby grants permission to reproduce the tables and figures in this paper solely for use in journalistic or scholarly works.'
        ) + 1)) AS cleaned_title
    FROM pr_papers
    WHERE LEFT(LOWER(title), CHAR_LENGTH(
        'Provided proper attribution is provided, Google hereby grants permission to reproduce the tables and figures in this paper solely for use in journalistic or scholarly works.'
    )) = LOWER(
        'Provided proper attribution is provided, Google hereby grants permission to reproduce the tables and figures in this paper solely for use in journalistic or scholarly works.'
    )
)
UPDATE pr_papers AS paper
SET
    title = cleanup.cleaned_title,
    updated_at = NOW()
FROM title_cleanup AS cleanup
WHERE paper.id = cleanup.id
  AND cleanup.cleaned_title <> ''
  AND cleanup.cleaned_title ~ '[[:alnum:]]';
