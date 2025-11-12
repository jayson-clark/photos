import { useEffect, useState } from 'react';
import { Users, UserCircle, Edit2, Trash2, X, GitMerge } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { peopleAPI } from '../lib/api';
import { Person } from '@photos/shared';

export default function People() {
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);
    const [editName, setEditName] = useState('');
    const [mergeMode, setMergeMode] = useState(false);
    const [selectedForMerge, setSelectedForMerge] = useState<number[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        loadPeople();
    }, []);

    const loadPeople = async () => {
        try {
            setLoading(true);
            const response = await peopleAPI.getAll();
            setPeople(response.data);
        } catch (error) {
            console.error('Failed to load people:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditPerson = (person: Person) => {
        setEditingPerson(person);
        setEditName(person.name || '');
    };

    const handleSaveName = async () => {
        if (!editingPerson) return;

        try {
            const response = await peopleAPI.update(editingPerson.id, { name: editName });
            setPeople(people.map((p) => (p.id === editingPerson.id ? response.data : p)));
            setEditingPerson(null);
            setEditName('');
        } catch (error) {
            console.error('Failed to update person:', error);
        }
    };

    const handleDeletePerson = async (person: Person) => {
        if (!confirm(`Delete ${person.name || 'this person'}? This will remove face tags from all photos.`)) {
            return;
        }

        try {
            await peopleAPI.delete(person.id);
            setPeople(people.filter((p) => p.id !== person.id));
        } catch (error) {
            console.error('Failed to delete person:', error);
        }
    };

    const handleViewPerson = (personId: number) => {
        navigate(`/people/${personId}`);
    };

    const toggleMergeSelection = (personId: number) => {
        setSelectedForMerge((prev) =>
            prev.includes(personId)
                ? prev.filter((id) => id !== personId)
                : [...prev, personId]
        );
    };

    const handleMerge = async () => {
        if (selectedForMerge.length !== 2) {
            alert('Please select exactly 2 people to merge');
            return;
        }

        const [first, second] = selectedForMerge;
        const person1 = people.find((p) => p.id === first);
        const person2 = people.find((p) => p.id === second);

        if (!person1 || !person2) return;

        const name1 = person1.name || `Person ${first}`;
        const name2 = person2.name || `Person ${second}`;

        if (!confirm(`Merge "${name2}" into "${name1}"? All photos from ${name2} will be moved to ${name1}.`)) {
            return;
        }

        try {
            await peopleAPI.merge(first, second);
            setMergeMode(false);
            setSelectedForMerge([]);
            await loadPeople();
        } catch (error) {
            console.error('Failed to merge people:', error);
            alert('Failed to merge people. Please try again.');
        }
    };

    const cancelMerge = () => {
        setMergeMode(false);
        setSelectedForMerge([]);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (people.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Users className="w-16 h-16 text-gray-400 mb-4" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">No People Detected</h2>
                <p className="text-gray-600 max-w-md">
                    Upload photos with faces, and we'll automatically detect and organize people for
                    you.
                </p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">People</h1>
                        <p className="text-gray-600 mt-2">
                            {people.length} {people.length === 1 ? 'person' : 'people'} detected in your
                            photos
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {mergeMode ? (
                            <>
                                <button
                                    onClick={handleMerge}
                                    disabled={selectedForMerge.length !== 2}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    <GitMerge className="w-4 h-4" />
                                    Merge ({selectedForMerge.length}/2)
                                </button>
                                <button
                                    onClick={cancelMerge}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setMergeMode(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                <GitMerge className="w-4 h-4" />
                                Merge People
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {people.map((person) => {
                    const isSelected = selectedForMerge.includes(person.id);
                    return (
                        <div
                            key={person.id}
                            className={`group relative bg-white rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer ${
                                isSelected ? 'ring-4 ring-blue-500' : ''
                            }`}
                            onClick={() =>
                                mergeMode ? toggleMergeSelection(person.id) : handleViewPerson(person.id)
                            }
                        >
                            <div className="aspect-square relative bg-gray-100">
                                {person.thumbnailUrl ? (
                                    <img
                                        src={`http://localhost:3001${person.thumbnailUrl}`}
                                        alt={person.name || 'Unknown'}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <UserCircle className="w-16 h-16 text-gray-400" />
                                    </div>
                                )}

                                {/* Merge selection indicator */}
                                {mergeMode && isSelected && (
                                    <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                            ✓
                                        </div>
                                    </div>
                                )}

                                {/* Action buttons (hidden in merge mode) */}
                                {!mergeMode && (
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditPerson(person);
                                            }}
                                            className="p-1.5 bg-white rounded-full shadow-md hover:bg-gray-50"
                                        >
                                            <Edit2 className="w-4 h-4 text-gray-700" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeletePerson(person);
                                            }}
                                            className="p-1.5 bg-white rounded-full shadow-md hover:bg-gray-50"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="p-3">
                                <h3 className="font-medium text-gray-900 truncate">
                                    {person.name || 'Unknown'}
                                </h3>
                                <p className="text-sm text-gray-500">
                                    {person.photoCount} {person.photoCount === 1 ? 'photo' : 'photos'}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Edit Name Modal */}
            {editingPerson && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">
                                {editingPerson.name ? 'Edit Name' : 'Add Name'}
                            </h2>
                            <button
                                onClick={() => setEditingPerson(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Name
                            </label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Enter name"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSaveName();
                                    }
                                }}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setEditingPerson(null)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveName}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
