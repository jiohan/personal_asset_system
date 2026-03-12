import StateNotice from '../components/StateNotice';

interface PlaceholderPageProps {
    title: string;
    slice: number;
}

export default function PlaceholderPage({ title, slice }: PlaceholderPageProps) {
    return (
        <div className="page-container placeholder-page management-page">
            <div className="page-header">
                <div>
                    <p className="page-kicker">Library</p>
                    <h1 className="page-title">{title} <span className="badge">Coming Soon</span></h1>
                </div>
            </div>
            <StateNotice
                tone="disabled"
                title={`${title} is not enabled yet.`}
                description={`This area stays disabled until Slice ${slice} ships.`}
            />
        </div>
    );
}
