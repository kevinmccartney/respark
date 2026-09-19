-- Notify API listeners when etl_sync rows change (CLI report-mode + any writer).
CREATE OR REPLACE FUNCTION ops.notify_etl_sync() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payload text;
  event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_type := 'sync.started';
    payload := json_build_object(
      'type', event_type,
      'sync', json_build_object(
        'id', NEW.id,
        'status', NEW.status,
        'includeCatalog', NEW.include_catalog,
        'includeEnrichment', NEW.include_enrichment,
        'enrichmentJobs', COALESCE(NEW.enrichment_jobs, '{}'::text[]),
        'startedAt', NEW.started_at,
        'completedAt', NEW.completed_at,
        'errorMessage', NEW.error_message
      )
    )::text;
  ELSE
    IF NEW.status IN ('success', 'partial_success', 'failed') AND NEW.completed_at IS NOT NULL THEN
      event_type := 'sync.completed';
      payload := json_build_object(
        'type', event_type,
        'syncId', NEW.id,
        'status', NEW.status,
        'completedAt', NEW.completed_at,
        'errorMessage', NEW.error_message
      )::text;
    ELSE
      event_type := 'sync.updated';
      payload := json_build_object(
        'type', event_type,
        'syncId', NEW.id,
        'status', NEW.status,
        'completedAt', NEW.completed_at,
        'errorMessage', NEW.error_message
      )::text;
    END IF;
  END IF;

  PERFORM pg_notify('etl_sync', payload);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS etl_sync_notify ON ops.etl_sync;
--> statement-breakpoint
CREATE TRIGGER etl_sync_notify
AFTER INSERT OR UPDATE ON ops.etl_sync
FOR EACH ROW
EXECUTE FUNCTION ops.notify_etl_sync();
